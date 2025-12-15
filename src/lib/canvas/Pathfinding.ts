/**
 * V3 Pathfinding Engine
 * Dijkstra and A* algorithms for magnetic lasso
 */

import { Point } from './types';

// ============================================
// PRIORITY QUEUE (MIN-HEAP)
// ============================================

class MinHeap<T> {
  private heap: { priority: number; value: T }[] = [];

  push(priority: number, value: T): void {
    this.heap.push({ priority, value });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min.value;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].priority <= this.heap[index].priority) break;
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}

// ============================================
// COST FUNCTIONS
// ============================================

export interface CostMap {
  width: number;
  height: number;
  costs: Float32Array;
}

export function createCostMapFromEdges(
  edgeMap: ImageData,
  invert: boolean = true
): CostMap {
  const { width, height, data } = edgeMap;
  const costs = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    // Use grayscale value (assuming edge map is grayscale)
    const edgeStrength = data[i * 4];
    // Low cost on edges, high cost off edges (if invert=true)
    costs[i] = invert ? (255 - edgeStrength) / 255 : edgeStrength / 255;
  }

  return { width, height, costs };
}

export function getCostAt(costMap: CostMap, x: number, y: number): number {
  if (x < 0 || x >= costMap.width || y < 0 || y >= costMap.height) {
    return Infinity;
  }
  return costMap.costs[y * costMap.width + x];
}

// ============================================
// NEIGHBOR FUNCTIONS
// ============================================

const NEIGHBORS_4 = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

const NEIGHBORS_8 = [
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: -1, cost: Math.SQRT2 },
  { dx: 1, dy: 0, cost: 1 },
  { dx: 1, dy: 1, cost: Math.SQRT2 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: -1, dy: 1, cost: Math.SQRT2 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: -1, dy: -1, cost: Math.SQRT2 },
];

function getNeighbors(x: number, y: number, mode: 4 | 8): { x: number; y: number; moveCost: number }[] {
  const neighbors = mode === 4 ? NEIGHBORS_4 : NEIGHBORS_8;
  return neighbors.map(n => ({
    x: x + n.dx,
    y: y + n.dy,
    moveCost: 'cost' in n ? (n as { cost: number }).cost : 1,
  }));
}

// ============================================
// DIJKSTRA'S ALGORITHM
// ============================================

export interface PathfindingOptions {
  neighborMode: 4 | 8;
  directionContinuityCost: number;
  cursorInfluence: number;
  maxIterations: number;
}

export interface PathfindingResult {
  path: Point[];
  cost: number;
  iterations: number;
  success: boolean;
}

function pointKey(x: number, y: number): number {
  return y * 100000 + x;
}

export function dijkstra(
  start: Point,
  end: Point,
  costMap: CostMap,
  options: PathfindingOptions
): PathfindingResult {
  const startTime = performance.now();
  const { neighborMode, directionContinuityCost, cursorInfluence, maxIterations } = options;

  const startX = Math.round(start.x);
  const startY = Math.round(start.y);
  const endX = Math.round(end.x);
  const endY = Math.round(end.y);

  const heap = new MinHeap<{ x: number; y: number; prevDir: number }>();
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();

  const startKey = pointKey(startX, startY);
  dist.set(startKey, 0);
  heap.push(0, { x: startX, y: startY, prevDir: -1 });

  let iterations = 0;
  const endKey = pointKey(endX, endY);

  while (!heap.isEmpty() && iterations < maxIterations) {
    iterations++;
    const current = heap.pop()!;
    const currentKey = pointKey(current.x, current.y);

    if (currentKey === endKey) {
      // Reconstruct path
      const path: Point[] = [];
      let key = endKey;
      while (key !== undefined && key !== startKey) {
        const y = Math.floor(key / 100000);
        const x = key % 100000;
        path.unshift({ x, y });
        key = prev.get(key)!;
      }
      path.unshift({ x: startX, y: startY });

      return {
        path,
        cost: dist.get(endKey) || 0,
        iterations,
        success: true,
      };
    }

    const neighbors = getNeighbors(current.x, current.y, neighborMode);

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= costMap.width ||
          neighbor.y < 0 || neighbor.y >= costMap.height) {
        continue;
      }

      const neighborKey = pointKey(neighbor.x, neighbor.y);
      const edgeCost = getCostAt(costMap, neighbor.x, neighbor.y);
      
      // Direction continuity cost
      let dirCost = 0;
      if (current.prevDir >= 0 && directionContinuityCost > 0) {
        const currentDir = Math.atan2(neighbor.y - current.y, neighbor.x - current.x);
        const dirDiff = Math.abs(currentDir - current.prevDir);
        dirCost = directionContinuityCost * Math.min(dirDiff, Math.PI * 2 - dirDiff) / Math.PI;
      }

      // Cursor influence (attraction toward end point)
      const distToEnd = Math.sqrt(
        (neighbor.x - endX) ** 2 + (neighbor.y - endY) ** 2
      );
      const cursorCost = (cursorInfluence / 100) * distToEnd * 0.01;

      const totalCost = (dist.get(currentKey) || 0) + 
                       neighbor.moveCost * (edgeCost + 0.01) + 
                       dirCost + 
                       cursorCost;

      if (!dist.has(neighborKey) || totalCost < dist.get(neighborKey)!) {
        dist.set(neighborKey, totalCost);
        prev.set(neighborKey, currentKey);
        heap.push(totalCost, {
          x: neighbor.x,
          y: neighbor.y,
          prevDir: Math.atan2(neighbor.y - current.y, neighbor.x - current.x),
        });
      }
    }
  }

  return {
    path: [],
    cost: Infinity,
    iterations,
    success: false,
  };
}

// ============================================
// A* ALGORITHM
// ============================================

function heuristic(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function astar(
  start: Point,
  end: Point,
  costMap: CostMap,
  options: PathfindingOptions
): PathfindingResult {
  const { neighborMode, directionContinuityCost, cursorInfluence, maxIterations } = options;

  const startX = Math.round(start.x);
  const startY = Math.round(start.y);
  const endX = Math.round(end.x);
  const endY = Math.round(end.y);

  const heap = new MinHeap<{ x: number; y: number; prevDir: number }>();
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();
  const prev = new Map<number, number>();

  const startKey = pointKey(startX, startY);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(startX, startY, endX, endY));
  heap.push(fScore.get(startKey)!, { x: startX, y: startY, prevDir: -1 });

  let iterations = 0;
  const endKey = pointKey(endX, endY);

  while (!heap.isEmpty() && iterations < maxIterations) {
    iterations++;
    const current = heap.pop()!;
    const currentKey = pointKey(current.x, current.y);

    if (currentKey === endKey) {
      // Reconstruct path
      const path: Point[] = [];
      let key = endKey;
      while (key !== undefined && key !== startKey) {
        const y = Math.floor(key / 100000);
        const x = key % 100000;
        path.unshift({ x, y });
        key = prev.get(key)!;
      }
      path.unshift({ x: startX, y: startY });

      return {
        path,
        cost: gScore.get(endKey) || 0,
        iterations,
        success: true,
      };
    }

    const neighbors = getNeighbors(current.x, current.y, neighborMode);

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= costMap.width ||
          neighbor.y < 0 || neighbor.y >= costMap.height) {
        continue;
      }

      const neighborKey = pointKey(neighbor.x, neighbor.y);
      const edgeCost = getCostAt(costMap, neighbor.x, neighbor.y);

      // Direction continuity cost
      let dirCost = 0;
      if (current.prevDir >= 0 && directionContinuityCost > 0) {
        const currentDir = Math.atan2(neighbor.y - current.y, neighbor.x - current.x);
        const dirDiff = Math.abs(currentDir - current.prevDir);
        dirCost = directionContinuityCost * Math.min(dirDiff, Math.PI * 2 - dirDiff) / Math.PI;
      }

      const tentativeG = (gScore.get(currentKey) || 0) + 
                         neighbor.moveCost * (edgeCost + 0.01) + 
                         dirCost;

      if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)!) {
        prev.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        
        // A* heuristic with cursor influence
        const h = heuristic(neighbor.x, neighbor.y, endX, endY) * (1 + cursorInfluence / 100);
        fScore.set(neighborKey, tentativeG + h);
        
        heap.push(fScore.get(neighborKey)!, {
          x: neighbor.x,
          y: neighbor.y,
          prevDir: Math.atan2(neighbor.y - current.y, neighbor.x - current.x),
        });
      }
    }
  }

  return {
    path: [],
    cost: Infinity,
    iterations,
    success: false,
  };
}

// ============================================
// PATH UTILITIES
// ============================================

export function simplifyPath(path: Point[], epsilon: number = 1.0): Point[] {
  if (path.length <= 2) return path;
  
  // Ramer-Douglas-Peucker algorithm
  function rdp(points: Point[], start: number, end: number, result: Point[]): void {
    let maxDist = 0;
    let maxIndex = start;
    
    const startPoint = points[start];
    const endPoint = points[end];
    
    for (let i = start + 1; i < end; i++) {
      const dist = perpendicularDistance(points[i], startPoint, endPoint);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    
    if (maxDist > epsilon) {
      rdp(points, start, maxIndex, result);
      result.push(points[maxIndex]);
      rdp(points, maxIndex, end, result);
    }
  }
  
  function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    
    const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
    const closestX = lineStart.x + u * dx;
    const closestY = lineStart.y + u * dy;
    return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
  }
  
  const result: Point[] = [path[0]];
  rdp(path, 0, path.length - 1, result);
  result.push(path[path.length - 1]);
  
  return result;
}

export function smoothPath(path: Point[], iterations: number = 2): Point[] {
  if (path.length <= 2) return path;
  
  let smoothed = [...path];
  
  for (let iter = 0; iter < iterations; iter++) {
    const newPath: Point[] = [smoothed[0]];
    
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];
      
      newPath.push({
        x: (prev.x + curr.x * 2 + next.x) / 4,
        y: (prev.y + curr.y * 2 + next.y) / 4,
      });
    }
    
    newPath.push(smoothed[smoothed.length - 1]);
    smoothed = newPath;
  }
  
  return smoothed;
}

export function chaikinSmooth(path: Point[], iterations: number = 2): Point[] {
  if (path.length <= 2) return path;
  
  let result = [...path];
  
  for (let iter = 0; iter < iterations; iter++) {
    const newPath: Point[] = [result[0]];
    
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];
      
      newPath.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });
      newPath.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }
    
    newPath.push(result[result.length - 1]);
    result = newPath;
  }
  
  return result;
}

export function getPathLength(path: Point[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

export function getPointAtDistance(path: Point[], distance: number): Point | null {
  if (path.length === 0) return null;
  if (distance <= 0) return path[0];
  
  let traveled = 0;
  
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const segLength = Math.sqrt(dx * dx + dy * dy);
    
    if (traveled + segLength >= distance) {
      const t = (distance - traveled) / segLength;
      return {
        x: path[i - 1].x + t * dx,
        y: path[i - 1].y + t * dy,
      };
    }
    
    traveled += segLength;
  }
  
  return path[path.length - 1];
}

export function resamplePath(path: Point[], spacing: number): Point[] {
  if (path.length <= 1) return path;
  
  const totalLength = getPathLength(path);
  const numPoints = Math.max(2, Math.ceil(totalLength / spacing));
  const result: Point[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const d = (i / (numPoints - 1)) * totalLength;
    const point = getPointAtDistance(path, d);
    if (point) result.push(point);
  }
  
  return result;
}
