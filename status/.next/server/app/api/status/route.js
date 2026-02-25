/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/status/route";
exports.ids = ["app/api/status/route"];
exports.modules = {

/***/ "(rsc)/./app/api/status/route.ts":
/*!*********************************!*\
  !*** ./app/api/status/route.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET),\n/* harmony export */   dynamic: () => (/* binding */ dynamic)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var _lib_checker__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/checker */ \"(rsc)/./lib/checker.ts\");\n/* harmony import */ var _lib_store__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/lib/store */ \"(rsc)/./lib/store.ts\");\n/* harmony import */ var _lib_services__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/lib/services */ \"(rsc)/./lib/services.ts\");\n\n\n\n\nconst dynamic = \"force-dynamic\";\nfunction calcUptime90d(history) {\n    if (history.length === 0) return null;\n    const totalChecks = history.reduce((s, d)=>s + d.checks, 0);\n    const totalFailures = history.reduce((s, d)=>s + d.failures, 0);\n    if (totalChecks === 0) return null;\n    return Number(((totalChecks - totalFailures) / totalChecks * 100).toFixed(2));\n}\nasync function GET() {\n    const serviceIds = _lib_services__WEBPACK_IMPORTED_MODULE_3__.services.map((s)=>s.id);\n    const [checks, historyMap] = await Promise.all([\n        (0,_lib_checker__WEBPACK_IMPORTED_MODULE_1__.checkAllServices)(),\n        (0,_lib_store__WEBPACK_IMPORTED_MODULE_2__.getAllHistory)(serviceIds)\n    ]);\n    (0,_lib_store__WEBPACK_IMPORTED_MODULE_2__.recordChecks)(checks.services).catch((err)=>{\n        console.error(\"[status] Failed to record checks to DynamoDB:\", err);\n    });\n    const services = checks.services.map((check)=>{\n        const history = historyMap[check.id] || [];\n        return {\n            ...check,\n            history,\n            uptimePercent90d: calcUptime90d(history)\n        };\n    });\n    const response = {\n        overall: checks.overall,\n        services,\n        checkedAt: checks.checkedAt\n    };\n    return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json(response, {\n        headers: {\n            \"Cache-Control\": \"public, s-maxage=30, stale-while-revalidate=60\"\n        }\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL3N0YXR1cy9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBMkM7QUFDTTtBQUNTO0FBQ0U7QUFHckQsTUFBTU0sVUFBVSxnQkFBZ0I7QUFFdkMsU0FBU0MsY0FBY0MsT0FBc0I7SUFDM0MsSUFBSUEsUUFBUUMsTUFBTSxLQUFLLEdBQUcsT0FBTztJQUNqQyxNQUFNQyxjQUFjRixRQUFRRyxNQUFNLENBQUMsQ0FBQ0MsR0FBR0MsSUFBTUQsSUFBSUMsRUFBRUMsTUFBTSxFQUFFO0lBQzNELE1BQU1DLGdCQUFnQlAsUUFBUUcsTUFBTSxDQUFDLENBQUNDLEdBQUdDLElBQU1ELElBQUlDLEVBQUVHLFFBQVEsRUFBRTtJQUMvRCxJQUFJTixnQkFBZ0IsR0FBRyxPQUFPO0lBQzlCLE9BQU9PLE9BQU8sQ0FBQyxDQUFFUCxjQUFjSyxhQUFZLElBQUtMLGNBQWUsR0FBRSxFQUFHUSxPQUFPLENBQUM7QUFDOUU7QUFFTyxlQUFlQztJQUNwQixNQUFNQyxhQUFhZixtREFBY0EsQ0FBQ2dCLEdBQUcsQ0FBQyxDQUFDVCxJQUFNQSxFQUFFVSxFQUFFO0lBQ2pELE1BQU0sQ0FBQ1IsUUFBUVMsV0FBVyxHQUFHLE1BQU1DLFFBQVFDLEdBQUcsQ0FBQztRQUM3Q3hCLDhEQUFnQkE7UUFDaEJDLHlEQUFhQSxDQUFDa0I7S0FDZjtJQUVEakIsd0RBQVlBLENBQUNXLE9BQU9WLFFBQVEsRUFBRXNCLEtBQUssQ0FBQyxDQUFDQztRQUNuQ0MsUUFBUUMsS0FBSyxDQUFDLGlEQUFpREY7SUFDakU7SUFFQSxNQUFNdkIsV0FBaUNVLE9BQU9WLFFBQVEsQ0FBQ2lCLEdBQUcsQ0FBQyxDQUFDUztRQUMxRCxNQUFNdEIsVUFBVWUsVUFBVSxDQUFDTyxNQUFNUixFQUFFLENBQUMsSUFBSSxFQUFFO1FBQzFDLE9BQU87WUFDTCxHQUFHUSxLQUFLO1lBQ1J0QjtZQUNBdUIsa0JBQWtCeEIsY0FBY0M7UUFDbEM7SUFDRjtJQUVBLE1BQU13QixXQUEyQjtRQUMvQkMsU0FBU25CLE9BQU9tQixPQUFPO1FBQ3ZCN0I7UUFDQThCLFdBQVdwQixPQUFPb0IsU0FBUztJQUM3QjtJQUVBLE9BQU9sQyxxREFBWUEsQ0FBQ21DLElBQUksQ0FBQ0gsVUFBVTtRQUNqQ0ksU0FBUztZQUNQLGlCQUFpQjtRQUNuQjtJQUNGO0FBQ0YiLCJzb3VyY2VzIjpbIi9Vc2Vycy9ubmFnZWxpYS9Eb2N1bWVudHMvQ3V0dHIvY2xpcHBlci9zdGF0dXMvYXBwL2FwaS9zdGF0dXMvcm91dGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTmV4dFJlc3BvbnNlIH0gZnJvbSBcIm5leHQvc2VydmVyXCI7XG5pbXBvcnQgeyBjaGVja0FsbFNlcnZpY2VzIH0gZnJvbSBcIkAvbGliL2NoZWNrZXJcIjtcbmltcG9ydCB7IGdldEFsbEhpc3RvcnksIHJlY29yZENoZWNrcyB9IGZyb20gXCJAL2xpYi9zdG9yZVwiO1xuaW1wb3J0IHsgc2VydmljZXMgYXMgc2VydmljZUNvbmZpZ3MgfSBmcm9tIFwiQC9saWIvc2VydmljZXNcIjtcbmltcG9ydCB7IFNlcnZpY2VXaXRoSGlzdG9yeSwgU3RhdHVzUmVzcG9uc2UsIERhaWx5VXB0aW1lIH0gZnJvbSBcIkAvbGliL3R5cGVzXCI7XG5cbmV4cG9ydCBjb25zdCBkeW5hbWljID0gXCJmb3JjZS1keW5hbWljXCI7XG5cbmZ1bmN0aW9uIGNhbGNVcHRpbWU5MGQoaGlzdG9yeTogRGFpbHlVcHRpbWVbXSk6IG51bWJlciB8IG51bGwge1xuICBpZiAoaGlzdG9yeS5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuICBjb25zdCB0b3RhbENoZWNrcyA9IGhpc3RvcnkucmVkdWNlKChzLCBkKSA9PiBzICsgZC5jaGVja3MsIDApO1xuICBjb25zdCB0b3RhbEZhaWx1cmVzID0gaGlzdG9yeS5yZWR1Y2UoKHMsIGQpID0+IHMgKyBkLmZhaWx1cmVzLCAwKTtcbiAgaWYgKHRvdGFsQ2hlY2tzID09PSAwKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIE51bWJlcigoKCh0b3RhbENoZWNrcyAtIHRvdGFsRmFpbHVyZXMpIC8gdG90YWxDaGVja3MpICogMTAwKS50b0ZpeGVkKDIpKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEdFVCgpIHtcbiAgY29uc3Qgc2VydmljZUlkcyA9IHNlcnZpY2VDb25maWdzLm1hcCgocykgPT4gcy5pZCk7XG4gIGNvbnN0IFtjaGVja3MsIGhpc3RvcnlNYXBdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIGNoZWNrQWxsU2VydmljZXMoKSxcbiAgICBnZXRBbGxIaXN0b3J5KHNlcnZpY2VJZHMpLFxuICBdKTtcblxuICByZWNvcmRDaGVja3MoY2hlY2tzLnNlcnZpY2VzKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihcIltzdGF0dXNdIEZhaWxlZCB0byByZWNvcmQgY2hlY2tzIHRvIER5bmFtb0RCOlwiLCBlcnIpO1xuICB9KTtcblxuICBjb25zdCBzZXJ2aWNlczogU2VydmljZVdpdGhIaXN0b3J5W10gPSBjaGVja3Muc2VydmljZXMubWFwKChjaGVjaykgPT4ge1xuICAgIGNvbnN0IGhpc3RvcnkgPSBoaXN0b3J5TWFwW2NoZWNrLmlkXSB8fCBbXTtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uY2hlY2ssXG4gICAgICBoaXN0b3J5LFxuICAgICAgdXB0aW1lUGVyY2VudDkwZDogY2FsY1VwdGltZTkwZChoaXN0b3J5KSxcbiAgICB9O1xuICB9KTtcblxuICBjb25zdCByZXNwb25zZTogU3RhdHVzUmVzcG9uc2UgPSB7XG4gICAgb3ZlcmFsbDogY2hlY2tzLm92ZXJhbGwsXG4gICAgc2VydmljZXMsXG4gICAgY2hlY2tlZEF0OiBjaGVja3MuY2hlY2tlZEF0LFxuICB9O1xuXG4gIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihyZXNwb25zZSwge1xuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiQ2FjaGUtQ29udHJvbFwiOiBcInB1YmxpYywgcy1tYXhhZ2U9MzAsIHN0YWxlLXdoaWxlLXJldmFsaWRhdGU9NjBcIixcbiAgICB9LFxuICB9KTtcbn1cbiJdLCJuYW1lcyI6WyJOZXh0UmVzcG9uc2UiLCJjaGVja0FsbFNlcnZpY2VzIiwiZ2V0QWxsSGlzdG9yeSIsInJlY29yZENoZWNrcyIsInNlcnZpY2VzIiwic2VydmljZUNvbmZpZ3MiLCJkeW5hbWljIiwiY2FsY1VwdGltZTkwZCIsImhpc3RvcnkiLCJsZW5ndGgiLCJ0b3RhbENoZWNrcyIsInJlZHVjZSIsInMiLCJkIiwiY2hlY2tzIiwidG90YWxGYWlsdXJlcyIsImZhaWx1cmVzIiwiTnVtYmVyIiwidG9GaXhlZCIsIkdFVCIsInNlcnZpY2VJZHMiLCJtYXAiLCJpZCIsImhpc3RvcnlNYXAiLCJQcm9taXNlIiwiYWxsIiwiY2F0Y2giLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiLCJjaGVjayIsInVwdGltZVBlcmNlbnQ5MGQiLCJyZXNwb25zZSIsIm92ZXJhbGwiLCJjaGVja2VkQXQiLCJqc29uIiwiaGVhZGVycyJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./app/api/status/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/checker.ts":
/*!************************!*\
  !*** ./lib/checker.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   checkAllServices: () => (/* binding */ checkAllServices)\n/* harmony export */ });\n/* harmony import */ var _services__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./services */ \"(rsc)/./lib/services.ts\");\n\nasync function checkService(config) {\n    const start = Date.now();\n    try {\n        const controller = new AbortController();\n        const timer = setTimeout(()=>controller.abort(), config.timeout);\n        const res = await fetch(config.url, {\n            method: config.method,\n            signal: controller.signal,\n            redirect: \"follow\",\n            headers: {\n                \"User-Agent\": \"Cuttr-StatusChecker/1.0\"\n            }\n        });\n        clearTimeout(timer);\n        const responseTime = Date.now() - start;\n        let status = \"operational\";\n        if (!res.ok) {\n            status = \"outage\";\n        } else if (responseTime > config.degradedThreshold) {\n            status = \"degraded\";\n        }\n        return {\n            id: config.id,\n            name: config.name,\n            description: config.description,\n            status,\n            responseTime,\n            statusCode: res.status,\n            checkedAt: new Date().toISOString()\n        };\n    } catch  {\n        return {\n            id: config.id,\n            name: config.name,\n            description: config.description,\n            status: \"outage\",\n            responseTime: Date.now() - start,\n            statusCode: null,\n            checkedAt: new Date().toISOString()\n        };\n    }\n}\nfunction deriveOverallStatus(checks) {\n    if (checks.some((c)=>c.status === \"outage\")) return \"outage\";\n    if (checks.some((c)=>c.status === \"degraded\")) return \"degraded\";\n    if (checks.some((c)=>c.status === \"maintenance\")) return \"maintenance\";\n    return \"operational\";\n}\nasync function checkAllServices() {\n    const checks = await Promise.all(_services__WEBPACK_IMPORTED_MODULE_0__.services.map(checkService));\n    return {\n        overall: deriveOverallStatus(checks),\n        services: checks,\n        checkedAt: new Date().toISOString()\n    };\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvY2hlY2tlci50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUNzQztBQUV0QyxlQUFlQyxhQUFhQyxNQUFxQjtJQUMvQyxNQUFNQyxRQUFRQyxLQUFLQyxHQUFHO0lBQ3RCLElBQUk7UUFDRixNQUFNQyxhQUFhLElBQUlDO1FBQ3ZCLE1BQU1DLFFBQVFDLFdBQVcsSUFBTUgsV0FBV0ksS0FBSyxJQUFJUixPQUFPUyxPQUFPO1FBRWpFLE1BQU1DLE1BQU0sTUFBTUMsTUFBTVgsT0FBT1ksR0FBRyxFQUFFO1lBQ2xDQyxRQUFRYixPQUFPYSxNQUFNO1lBQ3JCQyxRQUFRVixXQUFXVSxNQUFNO1lBQ3pCQyxVQUFVO1lBQ1ZDLFNBQVM7Z0JBQUUsY0FBYztZQUEwQjtRQUNyRDtRQUVBQyxhQUFhWDtRQUNiLE1BQU1ZLGVBQWVoQixLQUFLQyxHQUFHLEtBQUtGO1FBRWxDLElBQUlrQixTQUF3QjtRQUM1QixJQUFJLENBQUNULElBQUlVLEVBQUUsRUFBRTtZQUNYRCxTQUFTO1FBQ1gsT0FBTyxJQUFJRCxlQUFlbEIsT0FBT3FCLGlCQUFpQixFQUFFO1lBQ2xERixTQUFTO1FBQ1g7UUFFQSxPQUFPO1lBQ0xHLElBQUl0QixPQUFPc0IsRUFBRTtZQUNiQyxNQUFNdkIsT0FBT3VCLElBQUk7WUFDakJDLGFBQWF4QixPQUFPd0IsV0FBVztZQUMvQkw7WUFDQUQ7WUFDQU8sWUFBWWYsSUFBSVMsTUFBTTtZQUN0Qk8sV0FBVyxJQUFJeEIsT0FBT3lCLFdBQVc7UUFDbkM7SUFDRixFQUFFLE9BQU07UUFDTixPQUFPO1lBQ0xMLElBQUl0QixPQUFPc0IsRUFBRTtZQUNiQyxNQUFNdkIsT0FBT3VCLElBQUk7WUFDakJDLGFBQWF4QixPQUFPd0IsV0FBVztZQUMvQkwsUUFBUTtZQUNSRCxjQUFjaEIsS0FBS0MsR0FBRyxLQUFLRjtZQUMzQndCLFlBQVk7WUFDWkMsV0FBVyxJQUFJeEIsT0FBT3lCLFdBQVc7UUFDbkM7SUFDRjtBQUNGO0FBRUEsU0FBU0Msb0JBQW9CQyxNQUFzQjtJQUNqRCxJQUFJQSxPQUFPQyxJQUFJLENBQUMsQ0FBQ0MsSUFBTUEsRUFBRVosTUFBTSxLQUFLLFdBQVcsT0FBTztJQUN0RCxJQUFJVSxPQUFPQyxJQUFJLENBQUMsQ0FBQ0MsSUFBTUEsRUFBRVosTUFBTSxLQUFLLGFBQWEsT0FBTztJQUN4RCxJQUFJVSxPQUFPQyxJQUFJLENBQUMsQ0FBQ0MsSUFBTUEsRUFBRVosTUFBTSxLQUFLLGdCQUFnQixPQUFPO0lBQzNELE9BQU87QUFDVDtBQVFPLGVBQWVhO0lBQ3BCLE1BQU1ILFNBQVMsTUFBTUksUUFBUUMsR0FBRyxDQUFDcEMsK0NBQVFBLENBQUNxQyxHQUFHLENBQUNwQztJQUM5QyxPQUFPO1FBQ0xxQyxTQUFTUixvQkFBb0JDO1FBQzdCL0IsVUFBVStCO1FBQ1ZILFdBQVcsSUFBSXhCLE9BQU95QixXQUFXO0lBQ25DO0FBQ0YiLCJzb3VyY2VzIjpbIi9Vc2Vycy9ubmFnZWxpYS9Eb2N1bWVudHMvQ3V0dHIvY2xpcHBlci9zdGF0dXMvbGliL2NoZWNrZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU2VydmljZUNvbmZpZywgU2VydmljZUNoZWNrLCBTZXJ2aWNlU3RhdHVzIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IHNlcnZpY2VzIH0gZnJvbSBcIi4vc2VydmljZXNcIjtcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tTZXJ2aWNlKGNvbmZpZzogU2VydmljZUNvbmZpZyk6IFByb21pc2U8U2VydmljZUNoZWNrPiB7XG4gIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIGNvbmZpZy50aW1lb3V0KTtcblxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGNvbmZpZy51cmwsIHtcbiAgICAgIG1ldGhvZDogY29uZmlnLm1ldGhvZCxcbiAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICByZWRpcmVjdDogXCJmb2xsb3dcIixcbiAgICAgIGhlYWRlcnM6IHsgXCJVc2VyLUFnZW50XCI6IFwiQ3V0dHItU3RhdHVzQ2hlY2tlci8xLjBcIiB9LFxuICAgIH0pO1xuXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnQ7XG5cbiAgICBsZXQgc3RhdHVzOiBTZXJ2aWNlU3RhdHVzID0gXCJvcGVyYXRpb25hbFwiO1xuICAgIGlmICghcmVzLm9rKSB7XG4gICAgICBzdGF0dXMgPSBcIm91dGFnZVwiO1xuICAgIH0gZWxzZSBpZiAocmVzcG9uc2VUaW1lID4gY29uZmlnLmRlZ3JhZGVkVGhyZXNob2xkKSB7XG4gICAgICBzdGF0dXMgPSBcImRlZ3JhZGVkXCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBjb25maWcuaWQsXG4gICAgICBuYW1lOiBjb25maWcubmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBjb25maWcuZGVzY3JpcHRpb24sXG4gICAgICBzdGF0dXMsXG4gICAgICByZXNwb25zZVRpbWUsXG4gICAgICBzdGF0dXNDb2RlOiByZXMuc3RhdHVzLFxuICAgICAgY2hlY2tlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgfTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBjb25maWcuaWQsXG4gICAgICBuYW1lOiBjb25maWcubmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBjb25maWcuZGVzY3JpcHRpb24sXG4gICAgICBzdGF0dXM6IFwib3V0YWdlXCIsXG4gICAgICByZXNwb25zZVRpbWU6IERhdGUubm93KCkgLSBzdGFydCxcbiAgICAgIHN0YXR1c0NvZGU6IG51bGwsXG4gICAgICBjaGVja2VkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlcml2ZU92ZXJhbGxTdGF0dXMoY2hlY2tzOiBTZXJ2aWNlQ2hlY2tbXSk6IFNlcnZpY2VTdGF0dXMge1xuICBpZiAoY2hlY2tzLnNvbWUoKGMpID0+IGMuc3RhdHVzID09PSBcIm91dGFnZVwiKSkgcmV0dXJuIFwib3V0YWdlXCI7XG4gIGlmIChjaGVja3Muc29tZSgoYykgPT4gYy5zdGF0dXMgPT09IFwiZGVncmFkZWRcIikpIHJldHVybiBcImRlZ3JhZGVkXCI7XG4gIGlmIChjaGVja3Muc29tZSgoYykgPT4gYy5zdGF0dXMgPT09IFwibWFpbnRlbmFuY2VcIikpIHJldHVybiBcIm1haW50ZW5hbmNlXCI7XG4gIHJldHVybiBcIm9wZXJhdGlvbmFsXCI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2hlY2tSZXN1bHQge1xuICBvdmVyYWxsOiBTZXJ2aWNlU3RhdHVzO1xuICBzZXJ2aWNlczogU2VydmljZUNoZWNrW107XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tBbGxTZXJ2aWNlcygpOiBQcm9taXNlPENoZWNrUmVzdWx0PiB7XG4gIGNvbnN0IGNoZWNrcyA9IGF3YWl0IFByb21pc2UuYWxsKHNlcnZpY2VzLm1hcChjaGVja1NlcnZpY2UpKTtcbiAgcmV0dXJuIHtcbiAgICBvdmVyYWxsOiBkZXJpdmVPdmVyYWxsU3RhdHVzKGNoZWNrcyksXG4gICAgc2VydmljZXM6IGNoZWNrcyxcbiAgICBjaGVja2VkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgfTtcbn1cbiJdLCJuYW1lcyI6WyJzZXJ2aWNlcyIsImNoZWNrU2VydmljZSIsImNvbmZpZyIsInN0YXJ0IiwiRGF0ZSIsIm5vdyIsImNvbnRyb2xsZXIiLCJBYm9ydENvbnRyb2xsZXIiLCJ0aW1lciIsInNldFRpbWVvdXQiLCJhYm9ydCIsInRpbWVvdXQiLCJyZXMiLCJmZXRjaCIsInVybCIsIm1ldGhvZCIsInNpZ25hbCIsInJlZGlyZWN0IiwiaGVhZGVycyIsImNsZWFyVGltZW91dCIsInJlc3BvbnNlVGltZSIsInN0YXR1cyIsIm9rIiwiZGVncmFkZWRUaHJlc2hvbGQiLCJpZCIsIm5hbWUiLCJkZXNjcmlwdGlvbiIsInN0YXR1c0NvZGUiLCJjaGVja2VkQXQiLCJ0b0lTT1N0cmluZyIsImRlcml2ZU92ZXJhbGxTdGF0dXMiLCJjaGVja3MiLCJzb21lIiwiYyIsImNoZWNrQWxsU2VydmljZXMiLCJQcm9taXNlIiwiYWxsIiwibWFwIiwib3ZlcmFsbCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./lib/checker.ts\n");

/***/ }),

/***/ "(rsc)/./lib/services.ts":
/*!*************************!*\
  !*** ./lib/services.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   services: () => (/* binding */ services)\n/* harmony export */ });\nconst services = [\n    {\n        id: \"api\",\n        name: \"API\",\n        description: \"api.cuttr.com\",\n        url: process.env.CHECK_API_URL || \"https://api.cuttr.com/health\",\n        method: \"GET\",\n        timeout: 10000,\n        degradedThreshold: 2000\n    },\n    {\n        id: \"platform\",\n        name: \"Platform\",\n        description: \"platform.cuttr.com\",\n        url: process.env.CHECK_PLATFORM_URL || \"https://platform.cuttr.com\",\n        method: \"GET\",\n        timeout: 10000,\n        degradedThreshold: 3000\n    },\n    {\n        id: \"worker\",\n        name: \"Worker\",\n        description: \"Video processing pipeline\",\n        url: process.env.CHECK_WORKER_URL || \"https://api.cuttr.com/health/worker\",\n        method: \"GET\",\n        timeout: 10000,\n        degradedThreshold: 2000\n    }\n];\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvc2VydmljZXMudHMiLCJtYXBwaW5ncyI6Ijs7OztBQUVPLE1BQU1BLFdBQTRCO0lBQ3ZDO1FBQ0VDLElBQUk7UUFDSkMsTUFBTTtRQUNOQyxhQUFhO1FBQ2JDLEtBQUtDLFFBQVFDLEdBQUcsQ0FBQ0MsYUFBYSxJQUFJO1FBQ2xDQyxRQUFRO1FBQ1JDLFNBQVM7UUFDVEMsbUJBQW1CO0lBQ3JCO0lBQ0E7UUFDRVQsSUFBSTtRQUNKQyxNQUFNO1FBQ05DLGFBQWE7UUFDYkMsS0FBS0MsUUFBUUMsR0FBRyxDQUFDSyxrQkFBa0IsSUFBSTtRQUN2Q0gsUUFBUTtRQUNSQyxTQUFTO1FBQ1RDLG1CQUFtQjtJQUNyQjtJQUNBO1FBQ0VULElBQUk7UUFDSkMsTUFBTTtRQUNOQyxhQUFhO1FBQ2JDLEtBQUtDLFFBQVFDLEdBQUcsQ0FBQ00sZ0JBQWdCLElBQUk7UUFDckNKLFFBQVE7UUFDUkMsU0FBUztRQUNUQyxtQkFBbUI7SUFDckI7Q0FDRCxDQUFDIiwic291cmNlcyI6WyIvVXNlcnMvbm5hZ2VsaWEvRG9jdW1lbnRzL0N1dHRyL2NsaXBwZXIvc3RhdHVzL2xpYi9zZXJ2aWNlcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTZXJ2aWNlQ29uZmlnIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuZXhwb3J0IGNvbnN0IHNlcnZpY2VzOiBTZXJ2aWNlQ29uZmlnW10gPSBbXG4gIHtcbiAgICBpZDogXCJhcGlcIixcbiAgICBuYW1lOiBcIkFQSVwiLFxuICAgIGRlc2NyaXB0aW9uOiBcImFwaS5jdXR0ci5jb21cIixcbiAgICB1cmw6IHByb2Nlc3MuZW52LkNIRUNLX0FQSV9VUkwgfHwgXCJodHRwczovL2FwaS5jdXR0ci5jb20vaGVhbHRoXCIsXG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgIHRpbWVvdXQ6IDEwMDAwLFxuICAgIGRlZ3JhZGVkVGhyZXNob2xkOiAyMDAwLFxuICB9LFxuICB7XG4gICAgaWQ6IFwicGxhdGZvcm1cIixcbiAgICBuYW1lOiBcIlBsYXRmb3JtXCIsXG4gICAgZGVzY3JpcHRpb246IFwicGxhdGZvcm0uY3V0dHIuY29tXCIsXG4gICAgdXJsOiBwcm9jZXNzLmVudi5DSEVDS19QTEFURk9STV9VUkwgfHwgXCJodHRwczovL3BsYXRmb3JtLmN1dHRyLmNvbVwiLFxuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICB0aW1lb3V0OiAxMDAwMCxcbiAgICBkZWdyYWRlZFRocmVzaG9sZDogMzAwMCxcbiAgfSxcbiAge1xuICAgIGlkOiBcIndvcmtlclwiLFxuICAgIG5hbWU6IFwiV29ya2VyXCIsXG4gICAgZGVzY3JpcHRpb246IFwiVmlkZW8gcHJvY2Vzc2luZyBwaXBlbGluZVwiLFxuICAgIHVybDogcHJvY2Vzcy5lbnYuQ0hFQ0tfV09SS0VSX1VSTCB8fCBcImh0dHBzOi8vYXBpLmN1dHRyLmNvbS9oZWFsdGgvd29ya2VyXCIsXG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgIHRpbWVvdXQ6IDEwMDAwLFxuICAgIGRlZ3JhZGVkVGhyZXNob2xkOiAyMDAwLFxuICB9LFxuXTtcbiJdLCJuYW1lcyI6WyJzZXJ2aWNlcyIsImlkIiwibmFtZSIsImRlc2NyaXB0aW9uIiwidXJsIiwicHJvY2VzcyIsImVudiIsIkNIRUNLX0FQSV9VUkwiLCJtZXRob2QiLCJ0aW1lb3V0IiwiZGVncmFkZWRUaHJlc2hvbGQiLCJDSEVDS19QTEFURk9STV9VUkwiLCJDSEVDS19XT1JLRVJfVVJMIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./lib/services.ts\n");

/***/ }),

/***/ "(rsc)/./lib/store.ts":
/*!**********************!*\
  !*** ./lib/store.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getAllHistory: () => (/* binding */ getAllHistory),\n/* harmony export */   getHistory: () => (/* binding */ getHistory),\n/* harmony export */   getTableInfo: () => (/* binding */ getTableInfo),\n/* harmony export */   isStoreConfigured: () => (/* binding */ isStoreConfigured),\n/* harmony export */   recordCheck: () => (/* binding */ recordCheck),\n/* harmony export */   recordChecks: () => (/* binding */ recordChecks)\n/* harmony export */ });\n/* harmony import */ var _aws_sdk_client_dynamodb__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @aws-sdk/client-dynamodb */ \"(rsc)/./node_modules/@aws-sdk/client-dynamodb/dist-es/DynamoDBClient.js\");\n/* harmony import */ var _aws_sdk_lib_dynamodb__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @aws-sdk/lib-dynamodb */ \"(rsc)/./node_modules/@aws-sdk/lib-dynamodb/dist-es/index.js\");\n\n\nconst TABLE_NAME = process.env.DYNAMO_TABLE_NAME || \"clipster-status-checks-prod\";\nconst REGION = process.env.AWS_REGION || \"us-west-2\";\nconst TTL_DAYS = 91;\nlet docClient = null;\nfunction getClient() {\n    if (docClient) return docClient;\n    const client = new _aws_sdk_client_dynamodb__WEBPACK_IMPORTED_MODULE_1__.DynamoDBClient({\n        region: REGION\n    });\n    docClient = _aws_sdk_lib_dynamodb__WEBPACK_IMPORTED_MODULE_0__.DynamoDBDocumentClient.from(client);\n    return docClient;\n}\nfunction todayUTC() {\n    return new Date().toISOString().split(\"T\")[0];\n}\nfunction ninetyDaysAgo() {\n    const d = new Date();\n    d.setDate(d.getDate() - 90);\n    return d.toISOString().split(\"T\")[0];\n}\nasync function recordCheck(check) {\n    const client = getClient();\n    if (!client) return;\n    const failed = check.status === \"outage\" ? 1 : 0;\n    const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;\n    await client.send(new _aws_sdk_lib_dynamodb__WEBPACK_IMPORTED_MODULE_0__.UpdateCommand({\n        TableName: TABLE_NAME,\n        Key: {\n            serviceId: check.id,\n            date: todayUTC()\n        },\n        UpdateExpression: \"ADD checks :one, failures :f, totalResponseTime :rt SET expiresAt = :ttl\",\n        ExpressionAttributeValues: {\n            \":one\": 1,\n            \":f\": failed,\n            \":rt\": check.responseTime,\n            \":ttl\": ttl\n        }\n    }));\n}\nasync function recordChecks(checks) {\n    await Promise.all(checks.map(recordCheck));\n}\nasync function getHistory(serviceId) {\n    const client = getClient();\n    if (!client) return [];\n    const result = await client.send(new _aws_sdk_lib_dynamodb__WEBPACK_IMPORTED_MODULE_0__.QueryCommand({\n        TableName: TABLE_NAME,\n        KeyConditionExpression: \"serviceId = :sid AND #d >= :start\",\n        ExpressionAttributeNames: {\n            \"#d\": \"date\"\n        },\n        ExpressionAttributeValues: {\n            \":sid\": serviceId,\n            \":start\": ninetyDaysAgo()\n        },\n        ScanIndexForward: true\n    }));\n    return (result.Items || []).map((item)=>({\n            date: item.date,\n            checks: item.checks || 0,\n            failures: item.failures || 0,\n            avgResponseTime: item.checks > 0 ? Math.round(item.totalResponseTime / item.checks) : 0,\n            uptimePercent: item.checks > 0 ? Number(((item.checks - item.failures) / item.checks * 100).toFixed(2)) : 100\n        }));\n}\nasync function getAllHistory(serviceIds) {\n    const entries = await Promise.all(serviceIds.map(async (id)=>[\n            id,\n            await getHistory(id)\n        ]));\n    return Object.fromEntries(entries);\n}\nfunction isStoreConfigured() {\n    return true;\n}\nfunction getTableInfo() {\n    return {\n        table: TABLE_NAME,\n        region: REGION\n    };\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LFNBQVNHO0lBQ2QsT0FBTztBQUNUO0FBRU8sU0FBU0M7SUFDZCxPQUFPO1FBQUVDLE9BQU8vRDtRQUFZVSxRQUFRTjtJQUFPO0FBQzdDIiwic291cmNlcyI6WyIvVXNlcnMvbm5hZ2VsaWEvRG9jdW1lbnRzL0N1dHRyL2NsaXBwZXIvc3RhdHVzL2xpYi9zdG9yZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gXCJAYXdzLXNkay9jbGllbnQtZHluYW1vZGJcIjtcbmltcG9ydCB7XG4gIER5bmFtb0RCRG9jdW1lbnRDbGllbnQsXG4gIFVwZGF0ZUNvbW1hbmQsXG4gIFF1ZXJ5Q29tbWFuZCxcbn0gZnJvbSBcIkBhd3Mtc2RrL2xpYi1keW5hbW9kYlwiO1xuaW1wb3J0IHsgU2VydmljZUNoZWNrLCBEYWlseVVwdGltZSB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmNvbnN0IFRBQkxFX05BTUUgPSBwcm9jZXNzLmVudi5EWU5BTU9fVEFCTEVfTkFNRSB8fCBcImNsaXBzdGVyLXN0YXR1cy1jaGVja3MtcHJvZFwiO1xuY29uc3QgUkVHSU9OID0gcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB8fCBcInVzLXdlc3QtMlwiO1xuY29uc3QgVFRMX0RBWVMgPSA5MTtcblxubGV0IGRvY0NsaWVudDogRHluYW1vREJEb2N1bWVudENsaWVudCB8IG51bGwgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRDbGllbnQoKTogRHluYW1vREJEb2N1bWVudENsaWVudCB7XG4gIGlmIChkb2NDbGllbnQpIHJldHVybiBkb2NDbGllbnQ7XG4gIGNvbnN0IGNsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7IHJlZ2lvbjogUkVHSU9OIH0pO1xuICBkb2NDbGllbnQgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oY2xpZW50KTtcbiAgcmV0dXJuIGRvY0NsaWVudDtcbn1cblxuZnVuY3Rpb24gdG9kYXlVVEMoKTogc3RyaW5nIHtcbiAgcmV0dXJuIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdChcIlRcIilbMF07XG59XG5cbmZ1bmN0aW9uIG5pbmV0eURheXNBZ28oKTogc3RyaW5nIHtcbiAgY29uc3QgZCA9IG5ldyBEYXRlKCk7XG4gIGQuc2V0RGF0ZShkLmdldERhdGUoKSAtIDkwKTtcbiAgcmV0dXJuIGQudG9JU09TdHJpbmcoKS5zcGxpdChcIlRcIilbMF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWNvcmRDaGVjayhjaGVjazogU2VydmljZUNoZWNrKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldENsaWVudCgpO1xuICBpZiAoIWNsaWVudCkgcmV0dXJuO1xuXG4gIGNvbnN0IGZhaWxlZCA9IGNoZWNrLnN0YXR1cyA9PT0gXCJvdXRhZ2VcIiA/IDEgOiAwO1xuICBjb25zdCB0dGwgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSArIFRUTF9EQVlTICogODY0MDA7XG5cbiAgYXdhaXQgY2xpZW50LnNlbmQoXG4gICAgbmV3IFVwZGF0ZUNvbW1hbmQoe1xuICAgICAgVGFibGVOYW1lOiBUQUJMRV9OQU1FLFxuICAgICAgS2V5OiB7IHNlcnZpY2VJZDogY2hlY2suaWQsIGRhdGU6IHRvZGF5VVRDKCkgfSxcbiAgICAgIFVwZGF0ZUV4cHJlc3Npb246XG4gICAgICAgIFwiQUREIGNoZWNrcyA6b25lLCBmYWlsdXJlcyA6ZiwgdG90YWxSZXNwb25zZVRpbWUgOnJ0IFNFVCBleHBpcmVzQXQgPSA6dHRsXCIsXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgIFwiOm9uZVwiOiAxLFxuICAgICAgICBcIjpmXCI6IGZhaWxlZCxcbiAgICAgICAgXCI6cnRcIjogY2hlY2sucmVzcG9uc2VUaW1lLFxuICAgICAgICBcIjp0dGxcIjogdHRsLFxuICAgICAgfSxcbiAgICB9KVxuICApO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVjb3JkQ2hlY2tzKGNoZWNrczogU2VydmljZUNoZWNrW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgUHJvbWlzZS5hbGwoY2hlY2tzLm1hcChyZWNvcmRDaGVjaykpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0SGlzdG9yeShzZXJ2aWNlSWQ6IHN0cmluZyk6IFByb21pc2U8RGFpbHlVcHRpbWVbXT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRDbGllbnQoKTtcbiAgaWYgKCFjbGllbnQpIHJldHVybiBbXTtcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBjbGllbnQuc2VuZChcbiAgICBuZXcgUXVlcnlDb21tYW5kKHtcbiAgICAgIFRhYmxlTmFtZTogVEFCTEVfTkFNRSxcbiAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246IFwic2VydmljZUlkID0gOnNpZCBBTkQgI2QgPj0gOnN0YXJ0XCIsXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHsgXCIjZFwiOiBcImRhdGVcIiB9LFxuICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICBcIjpzaWRcIjogc2VydmljZUlkLFxuICAgICAgICBcIjpzdGFydFwiOiBuaW5ldHlEYXlzQWdvKCksXG4gICAgICB9LFxuICAgICAgU2NhbkluZGV4Rm9yd2FyZDogdHJ1ZSxcbiAgICB9KVxuICApO1xuXG4gIHJldHVybiAocmVzdWx0Lkl0ZW1zIHx8IFtdKS5tYXAoKGl0ZW0pID0+ICh7XG4gICAgZGF0ZTogaXRlbS5kYXRlIGFzIHN0cmluZyxcbiAgICBjaGVja3M6IChpdGVtLmNoZWNrcyBhcyBudW1iZXIpIHx8IDAsXG4gICAgZmFpbHVyZXM6IChpdGVtLmZhaWx1cmVzIGFzIG51bWJlcikgfHwgMCxcbiAgICBhdmdSZXNwb25zZVRpbWU6XG4gICAgICAoaXRlbS5jaGVja3MgYXMgbnVtYmVyKSA+IDBcbiAgICAgICAgPyBNYXRoLnJvdW5kKChpdGVtLnRvdGFsUmVzcG9uc2VUaW1lIGFzIG51bWJlcikgLyAoaXRlbS5jaGVja3MgYXMgbnVtYmVyKSlcbiAgICAgICAgOiAwLFxuICAgIHVwdGltZVBlcmNlbnQ6XG4gICAgICAoaXRlbS5jaGVja3MgYXMgbnVtYmVyKSA+IDBcbiAgICAgICAgPyBOdW1iZXIoXG4gICAgICAgICAgICAoXG4gICAgICAgICAgICAgICgoKGl0ZW0uY2hlY2tzIGFzIG51bWJlcikgLSAoaXRlbS5mYWlsdXJlcyBhcyBudW1iZXIpKSAvXG4gICAgICAgICAgICAgICAgKGl0ZW0uY2hlY2tzIGFzIG51bWJlcikpICpcbiAgICAgICAgICAgICAgMTAwXG4gICAgICAgICAgICApLnRvRml4ZWQoMilcbiAgICAgICAgICApXG4gICAgICAgIDogMTAwLFxuICB9KSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRBbGxIaXN0b3J5KFxuICBzZXJ2aWNlSWRzOiBzdHJpbmdbXVxuKTogUHJvbWlzZTxSZWNvcmQ8c3RyaW5nLCBEYWlseVVwdGltZVtdPj4ge1xuICBjb25zdCBlbnRyaWVzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgc2VydmljZUlkcy5tYXAoYXN5bmMgKGlkKSA9PiBbaWQsIGF3YWl0IGdldEhpc3RvcnkoaWQpXSBhcyBjb25zdClcbiAgKTtcbiAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU3RvcmVDb25maWd1cmVkKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRhYmxlSW5mbygpOiB7IHRhYmxlOiBzdHJpbmc7IHJlZ2lvbjogc3RyaW5nIH0ge1xuICByZXR1cm4geyB0YWJsZTogVEFCTEVfTkFNRSwgcmVnaW9uOiBSRUdJT04gfTtcbn1cbiJdLCJuYW1lcyI6WyJEeW5hbW9EQkNsaWVudCIsIkR5bmFtb0RCRG9jdW1lbnRDbGllbnQiLCJVcGRhdGVDb21tYW5kIiwiUXVlcnlDb21tYW5kIiwiVEFCTEVfTkFNRSIsInByb2Nlc3MiLCJlbnYiLCJEWU5BTU9fVEFCTEVfTkFNRSIsIlJFR0lPTiIsIkFXU19SRUdJT04iLCJUVExfREFZUyIsImRvY0NsaWVudCIsImdldENsaWVudCIsImNsaWVudCIsInJlZ2lvbiIsImZyb20iLCJ0b2RheVVUQyIsIkRhdGUiLCJ0b0lTT1N0cmluZyIsInNwbGl0IiwibmluZXR5RGF5c0FnbyIsImQiLCJzZXREYXRlIiwiZ2V0RGF0ZSIsInJlY29yZENoZWNrIiwiY2hlY2siLCJmYWlsZWQiLCJzdGF0dXMiLCJ0dGwiLCJNYXRoIiwiZmxvb3IiLCJub3ciLCJzZW5kIiwiVGFibGVOYW1lIiwiS2V5Iiwic2VydmljZUlkIiwiaWQiLCJkYXRlIiwiVXBkYXRlRXhwcmVzc2lvbiIsIkV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXMiLCJyZXNwb25zZVRpbWUiLCJyZWNvcmRDaGVja3MiLCJjaGVja3MiLCJQcm9taXNlIiwiYWxsIiwibWFwIiwiZ2V0SGlzdG9yeSIsInJlc3VsdCIsIktleUNvbmRpdGlvbkV4cHJlc3Npb24iLCJFeHByZXNzaW9uQXR0cmlidXRlTmFtZXMiLCJTY2FuSW5kZXhGb3J3YXJkIiwiSXRlbXMiLCJpdGVtIiwiZmFpbHVyZXMiLCJhdmdSZXNwb25zZVRpbWUiLCJyb3VuZCIsInRvdGFsUmVzcG9uc2VUaW1lIiwidXB0aW1lUGVyY2VudCIsIk51bWJlciIsInRvRml4ZWQiLCJnZXRBbGxIaXN0b3J5Iiwic2VydmljZUlkcyIsImVudHJpZXMiLCJPYmplY3QiLCJmcm9tRW50cmllcyIsImlzU3RvcmVDb25maWd1cmVkIiwiZ2V0VGFibGVJbmZvIiwidGFibGUiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./lib/store.ts\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fstatus%2Froute&page=%2Fapi%2Fstatus%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fstatus%2Froute.ts&appDir=%2FUsers%2Fnnagelia%2FDocuments%2FCuttr%2Fclipper%2Fstatus%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fnnagelia%2FDocuments%2FCuttr%2Fclipper%2Fstatus&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fstatus%2Froute&page=%2Fapi%2Fstatus%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fstatus%2Froute.ts&appDir=%2FUsers%2Fnnagelia%2FDocuments%2FCuttr%2Fclipper%2Fstatus%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fnnagelia%2FDocuments%2FCuttr%2Fclipper%2Fstatus&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _Users_nnagelia_Documents_Cuttr_clipper_status_app_api_status_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/status/route.ts */ \"(rsc)/./app/api/status/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/status/route\",\n        pathname: \"/api/status\",\n        filename: \"route\",\n        bundlePath: \"app/api/status/route\"\n    },\n    resolvedPagePath: \"/Users/nnagelia/Documents/Cuttr/clipper/status/app/api/status/route.ts\",\n    nextConfigOutput,\n    userland: _Users_nnagelia_Documents_Cuttr_clipper_status_app_api_status_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZzdGF0dXMlMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRnN0YXR1cyUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRnN0YXR1cyUyRnJvdXRlLnRzJmFwcERpcj0lMkZVc2VycyUyRm5uYWdlbGlhJTJGRG9jdW1lbnRzJTJGQ3V0dHIlMkZjbGlwcGVyJTJGc3RhdHVzJTJGYXBwJnBhZ2VFeHRlbnNpb25zPXRzeCZwYWdlRXh0ZW5zaW9ucz10cyZwYWdlRXh0ZW5zaW9ucz1qc3gmcGFnZUV4dGVuc2lvbnM9anMmcm9vdERpcj0lMkZVc2VycyUyRm5uYWdlbGlhJTJGRG9jdW1lbnRzJTJGQ3V0dHIlMkZjbGlwcGVyJTJGc3RhdHVzJmlzRGV2PXRydWUmdHNjb25maWdQYXRoPXRzY29uZmlnLmpzb24mYmFzZVBhdGg9JmFzc2V0UHJlZml4PSZuZXh0Q29uZmlnT3V0cHV0PSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUErRjtBQUN2QztBQUNxQjtBQUNzQjtBQUNuRztBQUNBO0FBQ0E7QUFDQSx3QkFBd0IseUdBQW1CO0FBQzNDO0FBQ0EsY0FBYyxrRUFBUztBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsWUFBWTtBQUNaLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxRQUFRLHNEQUFzRDtBQUM5RDtBQUNBLFdBQVcsNEVBQVc7QUFDdEI7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUMwRjs7QUFFMUYiLCJzb3VyY2VzIjpbIiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1raW5kXCI7XG5pbXBvcnQgeyBwYXRjaEZldGNoIGFzIF9wYXRjaEZldGNoIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvbGliL3BhdGNoLWZldGNoXCI7XG5pbXBvcnQgKiBhcyB1c2VybGFuZCBmcm9tIFwiL1VzZXJzL25uYWdlbGlhL0RvY3VtZW50cy9DdXR0ci9jbGlwcGVyL3N0YXR1cy9hcHAvYXBpL3N0YXR1cy9yb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvc3RhdHVzL3JvdXRlXCIsXG4gICAgICAgIHBhdGhuYW1lOiBcIi9hcGkvc3RhdHVzXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9zdGF0dXMvcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCIvVXNlcnMvbm5hZ2VsaWEvRG9jdW1lbnRzL0N1dHRyL2NsaXBwZXIvc3RhdHVzL2FwcC9hcGkvc3RhdHVzL3JvdXRlLnRzXCIsXG4gICAgbmV4dENvbmZpZ091dHB1dCxcbiAgICB1c2VybGFuZFxufSk7XG4vLyBQdWxsIG91dCB0aGUgZXhwb3J0cyB0aGF0IHdlIG5lZWQgdG8gZXhwb3NlIGZyb20gdGhlIG1vZHVsZS4gVGhpcyBzaG91bGRcbi8vIGJlIGVsaW1pbmF0ZWQgd2hlbiB3ZSd2ZSBtb3ZlZCB0aGUgb3RoZXIgcm91dGVzIHRvIHRoZSBuZXcgZm9ybWF0LiBUaGVzZVxuLy8gYXJlIHVzZWQgdG8gaG9vayBpbnRvIHRoZSByb3V0ZS5cbmNvbnN0IHsgd29ya0FzeW5jU3RvcmFnZSwgd29ya1VuaXRBc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzIH0gPSByb3V0ZU1vZHVsZTtcbmZ1bmN0aW9uIHBhdGNoRmV0Y2goKSB7XG4gICAgcmV0dXJuIF9wYXRjaEZldGNoKHtcbiAgICAgICAgd29ya0FzeW5jU3RvcmFnZSxcbiAgICAgICAgd29ya1VuaXRBc3luY1N0b3JhZ2VcbiAgICB9KTtcbn1cbmV4cG9ydCB7IHJvdXRlTW9kdWxlLCB3b3JrQXN5bmNTdG9yYWdlLCB3b3JrVW5pdEFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MsIHBhdGNoRmV0Y2gsICB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1hcHAtcm91dGUuanMubWFwIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fstatus%2Froute&page=%2Fapi%2Fstatus%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fstatus%2Froute.ts&appDir=%2FUsers%2Fnnagelia%2FDocuments%2FCuttr%2Fclipper%2Fstatus%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fnnagelia%2FDocuments%2FCuttr%2Fclipper%2Fstatus&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("buffer");

/***/ }),

/***/ "child_process":
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
/***/ ((module) => {

"use strict";
module.exports = require("child_process");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ "fs/promises":
/*!******************************!*\
  !*** external "fs/promises" ***!
  \******************************/
/***/ ((module) => {

"use strict";
module.exports = require("fs/promises");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = require("https");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "node:async_hooks":
/*!***********************************!*\
  !*** external "node:async_hooks" ***!
  \***********************************/
/***/ ((module) => {

"use strict";
module.exports = require("node:async_hooks");

/***/ }),

/***/ "node:crypto":
/*!******************************!*\
  !*** external "node:crypto" ***!
  \******************************/
/***/ ((module) => {

"use strict";
module.exports = require("node:crypto");

/***/ }),

/***/ "node:fs":
/*!**************************!*\
  !*** external "node:fs" ***!
  \**************************/
/***/ ((module) => {

"use strict";
module.exports = require("node:fs");

/***/ }),

/***/ "node:fs/promises":
/*!***********************************!*\
  !*** external "node:fs/promises" ***!
  \***********************************/
/***/ ((module) => {

"use strict";
module.exports = require("node:fs/promises");

/***/ }),

/***/ "node:os":
/*!**************************!*\
  !*** external "node:os" ***!
  \**************************/
/***/ ((module) => {

"use strict";
module.exports = require("node:os");

/***/ }),

/***/ "node:path":
/*!****************************!*\
  !*** external "node:path" ***!
  \****************************/
/***/ ((module) => {

"use strict";
module.exports = require("node:path");

/***/ }),

/***/ "os":
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),

/***/ "process":
/*!**************************!*\
  !*** external "process" ***!
  \**************************/
/***/ ((module) => {

"use strict";
module.exports = require("process");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("stream");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

"use strict";
module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/@smithy","vendor-chunks/@aws-sdk","vendor-chunks/next","vendor-chunks/mnemonist","vendor-chunks/obliterator","vendor-chunks/@aws"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fstatus%2Froute&page=%2Fapi%2Fstatus%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fstatus%2Froute.ts&appDir=%2FUsers%2Fnnagelia%2FDocuments%2FCuttr%2Fclipper%2Fstatus%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fnnagelia%2FDocuments%2FCuttr%2Fclipper%2Fstatus&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();