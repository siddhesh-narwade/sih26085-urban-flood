import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.data_loader import dataset
from app.engine.drainage_graph import DrainageGraphEngine

def test_drainage_graph_construction():
    engine = DrainageGraphEngine(dataset.drainage_nodes, dataset.drainage_edges)
    assert len(engine.nodes_data) > 10
    assert len(engine.edges_data) > 10
    assert engine.graph.number_of_nodes() == len(engine.nodes_data)

def test_hydraulic_conveyance_and_surcharge():
    engine = DrainageGraphEngine(dataset.drainage_nodes, dataset.drainage_edges)
    
    # Case A: Low inflow (no surcharge)
    low_inflows = {"IN_KURLA_01": 0.2, "IN_KURLA_02": 0.2}
    node_res, edge_res = engine.solve_hydraulic_flow(low_inflows, blockage_pct=0.0)
    assert node_res["IN_KURLA_01"]["is_surcharged"] == False
    assert node_res["IN_KURLA_01"]["surcharge_m3s"] == 0.0

    # Case B: Extreme inflow exceeding conduit capacity
    extreme_inflows = {"IN_KURLA_01": 15.0, "IN_KURLA_02": 15.0}
    node_res_surch, edge_res_surch = engine.solve_hydraulic_flow(extreme_inflows, blockage_pct=50.0)
    assert node_res_surch["IN_KURLA_01"]["is_surcharged"] == True
    assert node_res_surch["IN_KURLA_01"]["surcharge_m3s"] > 0.0
