package com.deer.wms.base.system.service.statistics.impl;

import com.deer.wms.base.system.dao.statistics.WarehouseRankingMapper;
import com.deer.wms.base.system.dao.statistics.WarehouseRankingSnapshotMapper;
import com.deer.wms.base.system.model.TaskTypeConstant;
import com.deer.wms.base.system.model.statistics.WarehouseRankingDashboard;
import com.deer.wms.base.system.model.statistics.WarehouseRankingRequest;
import com.deer.wms.base.system.model.statistics.WarehouseRankingRow;
import com.deer.wms.base.system.model.statistics.WarehouseRankingSnapshot;
import com.deer.wms.base.system.model.statistics.WarehouseRankingType;
import com.deer.wms.base.system.service.statistics.IWarehouseRankingService;
import org.springframework.util.CollectionUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class WarehouseRankingServiceImpl implements IWarehouseRankingService {

    @Resource
    private WarehouseRankingSnapshotMapper snapshotMapper;

    @Resource
    private WarehouseRankingMapper rankingMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WarehouseRankingDashboard fetchDashboard(WarehouseRankingRequest request) {
        request.normalize();
        WarehouseRankingDashboard dashboard = new WarehouseRankingDashboard();
        dashboard.setInventory(loadRanking(WarehouseRankingType.INVENTORY, request));
        dashboard.setInbound(loadRanking(WarehouseRankingType.INBOUND, request));
        dashboard.setOutbound(loadRanking(WarehouseRankingType.OUTBOUND, request));
        return dashboard;
    }

    private List<WarehouseRankingSnapshot> loadRanking(WarehouseRankingType type, WarehouseRankingRequest request) {
        List<WarehouseRankingSnapshot> existing = snapshotMapper.selectPeriod(type.getValue(),
                request.getPeriodType().name(), request.getNormalizedPeriodValue());
        boolean needRefresh = Boolean.TRUE.equals(request.getRefresh())
                || CollectionUtils.isEmpty(existing)
                || existing.size() < request.getLimit();
        if (!needRefresh) {
            return trim(existing, request.getLimit());
        }
        List<WarehouseRankingSnapshot> computed = compute(type, request);
        snapshotMapper.deletePeriod(type.getValue(), request.getPeriodType().name(), request.getNormalizedPeriodValue());
        if (!CollectionUtils.isEmpty(computed)) {
            snapshotMapper.batchInsert(computed);
        }
        return trim(computed, request.getLimit());
    }

    private List<WarehouseRankingSnapshot> compute(WarehouseRankingType type, WarehouseRankingRequest request) {
        List<WarehouseRankingRow> rows = new ArrayList<>();
        switch (type) {
            case INVENTORY:
                rows = rankingMapper.selectInventoryRanking(request.getLimit());
                break;
            case INBOUND:
                rows = rankingMapper.selectInboundRanking(request.getStartTimeText(), request.getEndTimeText(), request.getLimit());
                break;
            case OUTBOUND:
                rows = rankingMapper.selectOutboundRanking(request.getStartTimeText(), request.getEndTimeText(), request.getLimit());
                break;
            default:
                break;
        }
        return toSnapshots(rows, type, request);
    }

    private List<WarehouseRankingSnapshot> toSnapshots(List<WarehouseRankingRow> rows,
                                                       WarehouseRankingType type,
                                                       WarehouseRankingRequest request) {
        if (CollectionUtils.isEmpty(rows)) {
            return new ArrayList<>();
        }
        String wareName = TaskTypeConstant.wareInfo == null ? "" : TaskTypeConstant.wareInfo.getWareName();
        Date snapshotTime = new Date();
        List<WarehouseRankingSnapshot> snapshots = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            WarehouseRankingRow row = rows.get(i);
            WarehouseRankingSnapshot snapshot = new WarehouseRankingSnapshot();
            snapshot.setRankType(type.getValue());
            snapshot.setPeriodType(request.getPeriodType().name());
            snapshot.setPeriodValue(request.getNormalizedPeriodValue());
            snapshot.setTopOrder(i + 1);
            snapshot.setItemCode(row.getItemCode());
            snapshot.setItemName(row.getItemName());
            snapshot.setQuantity(row.getQuantity() == null ? BigDecimal.ZERO : row.getQuantity());
            snapshot.setUnit(row.getUnit());
            snapshot.setWarehouseName(wareName);
            snapshot.setSnapshotTime(snapshotTime);
            snapshots.add(snapshot);
        }
        snapshots.sort(Comparator.comparing(WarehouseRankingSnapshot::getTopOrder));
        return snapshots;
    }

    private List<WarehouseRankingSnapshot> trim(List<WarehouseRankingSnapshot> snapshots, int limit) {
        if (CollectionUtils.isEmpty(snapshots)) {
            return new ArrayList<>();
        }
        return snapshots.stream()
                .sorted(Comparator.comparing(WarehouseRankingSnapshot::getTopOrder))
                .limit(limit)
                .collect(Collectors.toList());
    }
}

