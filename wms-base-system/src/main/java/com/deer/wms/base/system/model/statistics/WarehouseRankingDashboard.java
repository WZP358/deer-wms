package com.deer.wms.base.system.model.statistics;

import java.util.Collections;
import java.util.List;

/**
 * Aggregated payload returned to the front-end containing every ranking block.
 */
public class WarehouseRankingDashboard {

    private List<WarehouseRankingSnapshot> inventory = Collections.emptyList();

    private List<WarehouseRankingSnapshot> inbound = Collections.emptyList();

    private List<WarehouseRankingSnapshot> outbound = Collections.emptyList();

    public List<WarehouseRankingSnapshot> getInventory() {
        return inventory;
    }

    public void setInventory(List<WarehouseRankingSnapshot> inventory) {
        this.inventory = inventory;
    }

    public List<WarehouseRankingSnapshot> getInbound() {
        return inbound;
    }

    public void setInbound(List<WarehouseRankingSnapshot> inbound) {
        this.inbound = inbound;
    }

    public List<WarehouseRankingSnapshot> getOutbound() {
        return outbound;
    }

    public void setOutbound(List<WarehouseRankingSnapshot> outbound) {
        this.outbound = outbound;
    }
}

