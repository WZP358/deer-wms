package com.deer.wms.base.system.dao.statistics;

import com.deer.wms.base.system.model.statistics.WarehouseRankingRow;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface WarehouseRankingMapper {

    List<WarehouseRankingRow> selectInventoryRanking(@Param("limit") int limit);

    List<WarehouseRankingRow> selectInboundRanking(@Param("startTime") String startTime,
                                                   @Param("endTime") String endTime,
                                                   @Param("limit") int limit);

    List<WarehouseRankingRow> selectOutboundRanking(@Param("startTime") String startTime,
                                                    @Param("endTime") String endTime,
                                                    @Param("limit") int limit);
}

