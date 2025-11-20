package com.deer.wms.base.system.service.statistics;

import com.deer.wms.base.system.model.statistics.WarehouseRankingDashboard;
import com.deer.wms.base.system.model.statistics.WarehouseRankingRequest;

public interface IWarehouseRankingService {

    WarehouseRankingDashboard fetchDashboard(WarehouseRankingRequest request);
}

