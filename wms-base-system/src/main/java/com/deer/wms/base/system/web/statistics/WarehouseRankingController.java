package com.deer.wms.base.system.web.statistics;

import com.deer.wms.base.system.model.statistics.WarehouseRankingDashboard;
import com.deer.wms.base.system.model.statistics.WarehouseRankingRequest;
import com.deer.wms.base.system.service.statistics.IWarehouseRankingService;
import com.deer.wms.common.core.controller.BaseController;
import com.deer.wms.common.core.result.Result;
import com.deer.wms.common.core.result.ResultGenerator;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.annotation.Resource;

@Controller
@RequestMapping("/system/ranking")
public class WarehouseRankingController extends BaseController {

    @Resource
    private IWarehouseRankingService warehouseRankingService;

    @GetMapping("/dashboard")
    @ResponseBody
    public Result dashboard(WarehouseRankingRequest request) {
        WarehouseRankingDashboard dashboard = warehouseRankingService.fetchDashboard(request);
        return ResultGenerator.genSuccessResult(dashboard);
    }
}

