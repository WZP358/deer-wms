package com.deer.wms.base.system.model.statistics;

import java.math.BigDecimal;

/**
 * Lightweight DTO returned by aggregation queries before persisting to snapshots.
 */
public class WarehouseRankingRow {

    private String itemCode;

    private String itemName;

    private BigDecimal quantity;

    private String unit;

    public String getItemCode() {
        return itemCode;
    }

    public void setItemCode(String itemCode) {
        this.itemCode = itemCode;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }
}

