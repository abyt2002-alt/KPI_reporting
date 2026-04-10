"""
Optimization Models
- Budget allocation
- Media mix optimization
- etc.
"""
import numpy as np
import pandas as pd
from scipy.optimize import minimize, differential_evolution
from typing import Dict, Any, List, Callable


def optimize_budget(
    budget: float,
    channels: List[str],
    response_curves: Dict[str, Callable],
    constraints: Dict[str, Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Optimize budget allocation across channels
    
    Args:
        budget: Total budget to allocate
        channels: List of channel names
        response_curves: Dict of channel -> response function
        constraints: Dict of channel -> {min: x, max: y}
    
    Returns:
        Optimal allocation and expected outcome
    """
    n_channels = len(channels)
    
    # Default constraints
    if constraints is None:
        constraints = {ch: {"min": 0, "max": budget} for ch in channels}
    
    # Objective: maximize total response (negative for minimization)
    def objective(x):
        total = 0
        for i, ch in enumerate(channels):
            if ch in response_curves:
                total += response_curves[ch](x[i])
        return -total  # Negative because we minimize
    
    # Budget constraint
    def budget_constraint(x):
        return budget - sum(x)
    
    # Bounds
    bounds = [(constraints.get(ch, {}).get("min", 0), 
               constraints.get(ch, {}).get("max", budget)) 
              for ch in channels]
    
    # Initial guess: equal distribution
    x0 = np.array([budget / n_channels] * n_channels)
    
    # Optimize
    result = minimize(
        objective,
        x0,
        method='SLSQP',
        bounds=bounds,
        constraints={'type': 'eq', 'fun': budget_constraint}
    )
    
    # Format result
    allocation = dict(zip(channels, result.x.tolist()))
    
    return {
        "allocation": allocation,
        "total_budget": float(sum(result.x)),
        "expected_outcome": float(-result.fun),
        "success": result.success,
        "message": result.message
    }


def hill_function(x: float, beta: float, k: float, s: float = 1.0) -> float:
    """
    Hill/Saturation response curve
    
    Args:
        x: Spend/input
        beta: Maximum effect (saturation level)
        k: Half-saturation point
        s: Shape parameter (steepness)
    
    Returns:
        Response value
    """
    if x <= 0:
        return 0
    return beta * (x ** s) / (k ** s + x ** s)


def adstock_transform(x: np.ndarray, decay: float = 0.5) -> np.ndarray:
    """
    Apply adstock transformation (carryover effect)
    
    Args:
        x: Input array (e.g., weekly spend)
        decay: Decay rate (0-1)
    
    Returns:
        Transformed array with carryover
    """
    result = np.zeros_like(x, dtype=float)
    result[0] = x[0]
    for i in range(1, len(x)):
        result[i] = x[i] + decay * result[i-1]
    return result
