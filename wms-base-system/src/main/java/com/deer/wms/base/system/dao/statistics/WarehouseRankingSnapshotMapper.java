package com.deer.wms.base.system.dao.statistics;

import com.deer.wms.base.system.model.statistics.WarehouseRankingSnapshot;
import com.deer.wms.common.core.commonMapper.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface WarehouseRankingSnapshotMapper extends Mapper<WarehouseRankingSnapshot> {

    List<WarehouseRankingSnapshot> selectPeriod(@Param("rankType") String rankType,
                                                @Param("periodType") String periodType,
                                                @Param("periodValue") String periodValue);

    int deletePeriod(@Param("rankType") String rankType,
                     @Param("periodType") String periodType,
                     @Param("periodValue") String periodValue);

    int batchInsert(@Param("list") List<WarehouseRankingSnapshot> snapshots);
}

