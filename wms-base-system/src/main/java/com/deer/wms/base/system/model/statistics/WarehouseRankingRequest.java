package com.deer.wms.base.system.model.statistics;

import com.deer.wms.common.core.result.CommonCode;
import com.deer.wms.common.exception.ServiceException;
import org.apache.commons.lang3.StringUtils;

import java.time.LocalDateTime;
import java.time.Year;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * Request parameters coming from the dashboard.
 */
public class WarehouseRankingRequest {

    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final DateTimeFormatter YEAR_FORMAT = DateTimeFormatter.ofPattern("yyyy");
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter YEAR_ONLY_FORMAT = DateTimeFormatter.ofPattern("yyyy");

    private WarehouseRankingPeriodType periodType = WarehouseRankingPeriodType.MONTH;

    /** yyyy-MM when month / yyyy when year */
    private String periodValue;

    /** Top-N limit, default 10 */
    private Integer limit = 10;

    /** Force refresh snapshot */
    private Boolean refresh = Boolean.FALSE;

    private LocalDateTime periodStart;
    private LocalDateTime periodEnd;

    public WarehouseRankingPeriodType getPeriodType() {
        return periodType;
    }

    public void setPeriodType(WarehouseRankingPeriodType periodType) {
        this.periodType = periodType;
    }

    public String getPeriodValue() {
        return periodValue;
    }

    public void setPeriodValue(String periodValue) {
        this.periodValue = periodValue;
    }

    public Integer getLimit() {
        return limit;
    }

    public void setLimit(Integer limit) {
        this.limit = limit;
    }

    public Boolean getRefresh() {
        return refresh;
    }

    public void setRefresh(Boolean refresh) {
        this.refresh = refresh;
    }

    public String getStartTimeText() {
        return periodStart == null ? null : periodStart.format(DATE_TIME_FORMAT);
    }

    public String getEndTimeText() {
        return periodEnd == null ? null : periodEnd.format(DATE_TIME_FORMAT);
    }

    /**
     * Returns the normalized value stored in DB (yyyy-MM or yyyy).
     */
    public String getNormalizedPeriodValue() {
        if (periodType == WarehouseRankingPeriodType.YEAR) {
            return periodStart == null ? Year.now().format(YEAR_FORMAT) : periodStart.format(YEAR_ONLY_FORMAT);
        }
        return periodStart == null ? YearMonth.now().format(MONTH_FORMAT) : periodStart.format(MONTH_FORMAT);
    }

    public void normalize() {
        if (periodType == null) {
            periodType = WarehouseRankingPeriodType.MONTH;
        }
        if (limit == null || limit <= 0) {
            limit = 10;
        }
        if (limit > 30) {
            limit = 30;
        }
        if (refresh == null) {
            refresh = Boolean.FALSE;
        }
        buildPeriodRange();
    }

    private void buildPeriodRange() {
        try {
            if (periodType == WarehouseRankingPeriodType.YEAR) {
                Year year = StringUtils.isBlank(periodValue) ? Year.now() : Year.parse(periodValue, YEAR_FORMAT);
                periodStart = year.atDay(1).atStartOfDay();
                periodEnd = year.plusYears(1).atDay(1).atStartOfDay();
            } else {
                YearMonth month = StringUtils.isBlank(periodValue) ? YearMonth.now() : YearMonth.parse(periodValue, MONTH_FORMAT);
                periodStart = month.atDay(1).atStartOfDay();
                periodEnd = month.plusMonths(1).atDay(1).atStartOfDay();
            }
        } catch (DateTimeParseException ex) {
            throw new ServiceException(CommonCode.GENERAL_WARING_CODE, "时间格式不正确，请检查选择的月份或年份");
        }
    }
}

