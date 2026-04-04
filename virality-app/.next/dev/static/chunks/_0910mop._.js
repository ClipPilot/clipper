(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/packages/shared-ui/src/components/StatusChip.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StatusChip",
    ()=>StatusChip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/virality-app/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2d$ui$2f$node_modules$2f40$heroui$2f$react$2f$dist$2f$components$2f$chip$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared-ui/node_modules/@heroui/react/dist/components/chip/index.js [app-client] (ecmascript) <locals>");
"use client";
;
;
const statusConfig = {
    pending: {
        color: "default",
        label: "Pending"
    },
    completed: {
        color: "success",
        label: "Completed"
    },
    failed: {
        color: "danger",
        label: "Failed"
    }
};
function StatusChip({ status, size = "sm" }) {
    const config = statusConfig[status];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2d$ui$2f$node_modules$2f40$heroui$2f$react$2f$dist$2f$components$2f$chip$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Chip"], {
        color: config.color,
        size: size,
        variant: "soft",
        children: config.label
    }, void 0, false, {
        fileName: "[project]/packages/shared-ui/src/components/StatusChip.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
_c = StatusChip;
var _c;
__turbopack_context__.k.register(_c, "StatusChip");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared-ui/src/components/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2d$ui$2f$src$2f$components$2f$StatusChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared-ui/src/components/StatusChip.tsx [app-client] (ecmascript)");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/shared-ui/src/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2d$ui$2f$src$2f$components$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared-ui/src/components/index.ts [app-client] (ecmascript) <locals>");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/virality-app/src/app/example-posts.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ExamplePosts",
    ()=>ExamplePosts
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/virality-app/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2d$ui$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared-ui/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2d$ui$2f$src$2f$components$2f$StatusChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared-ui/src/components/StatusChip.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f40$heroui$2f$react$2f$dist$2f$components$2f$card$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/virality-app/node_modules/@heroui/react/dist/components/card/index.js [app-client] (ecmascript) <locals>");
"use client";
;
;
;
const mockPosts = [
    {
        id: 1,
        caption: "How to grow your brand on TikTok in 2026",
        like_count: 12400,
        comment_count: 342,
        video_view_count: 98000,
        post_url: "https://tiktok.com/@example/1",
        posted_at: "2026-04-01T10:00:00Z"
    },
    {
        id: 2,
        caption: "Behind the scenes of our latest campaign",
        like_count: 5600,
        comment_count: 128,
        video_view_count: 34000,
        post_url: "https://instagram.com/p/example2",
        posted_at: "2026-04-02T14:30:00Z"
    },
    {
        id: 3,
        caption: "5 editing tricks that went viral",
        like_count: 28900,
        comment_count: 890,
        video_view_count: 210000,
        post_url: "https://tiktok.com/@example/3",
        posted_at: "2026-04-03T09:15:00Z"
    }
];
function formatCount(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}
const statuses = [
    "completed",
    "pending",
    "failed"
];
function ExamplePosts() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid grid-cols-1 md:grid-cols-3 gap-4",
        children: mockPosts.map((post, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f40$heroui$2f$react$2f$dist$2f$components$2f$card$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Card"], {
                className: "bg-zinc-900 border border-zinc-800",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f40$heroui$2f$react$2f$dist$2f$components$2f$card$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Card"].Header, {
                        className: "flex justify-between items-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-sm text-zinc-400 truncate max-w-[200px]",
                                children: post.post_url
                            }, void 0, false, {
                                fileName: "[project]/virality-app/src/app/example-posts.tsx",
                                lineNumber: 63,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2d$ui$2f$src$2f$components$2f$StatusChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusChip"], {
                                status: statuses[i]
                            }, void 0, false, {
                                fileName: "[project]/virality-app/src/app/example-posts.tsx",
                                lineNumber: 66,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/virality-app/src/app/example-posts.tsx",
                        lineNumber: 62,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f40$heroui$2f$react$2f$dist$2f$components$2f$card$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Card"].Content, {
                        className: "space-y-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-white text-sm",
                                children: post.caption
                            }, void 0, false, {
                                fileName: "[project]/virality-app/src/app/example-posts.tsx",
                                lineNumber: 69,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex gap-4 text-xs text-zinc-400",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            formatCount(post.like_count),
                                            " likes"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/virality-app/src/app/example-posts.tsx",
                                        lineNumber: 71,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            formatCount(post.comment_count),
                                            " comments"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/virality-app/src/app/example-posts.tsx",
                                        lineNumber: 72,
                                        columnNumber: 15
                                    }, this),
                                    post.video_view_count && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            formatCount(post.video_view_count),
                                            " views"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/virality-app/src/app/example-posts.tsx",
                                        lineNumber: 74,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/virality-app/src/app/example-posts.tsx",
                                lineNumber: 70,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$virality$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-xs text-zinc-500",
                                children: new Date(post.posted_at).toLocaleDateString()
                            }, void 0, false, {
                                fileName: "[project]/virality-app/src/app/example-posts.tsx",
                                lineNumber: 77,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/virality-app/src/app/example-posts.tsx",
                        lineNumber: 68,
                        columnNumber: 11
                    }, this)
                ]
            }, post.id, true, {
                fileName: "[project]/virality-app/src/app/example-posts.tsx",
                lineNumber: 61,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/virality-app/src/app/example-posts.tsx",
        lineNumber: 59,
        columnNumber: 5
    }, this);
}
_c = ExamplePosts;
var _c;
__turbopack_context__.k.register(_c, "ExamplePosts");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_0910mop._.js.map