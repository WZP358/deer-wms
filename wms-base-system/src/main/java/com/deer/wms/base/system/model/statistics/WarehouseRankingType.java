package com.deer.wms.base.system.model.statistics;

/**
 * Ranking categories supported by the warehouse dashboard.
 */
public enum WarehouseRankingType {

    INVENTORY("inventory"),
    INBOUND("inbound"),
    OUTBOUND("outbound");

    private final String value;

    WarehouseRankingType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}

