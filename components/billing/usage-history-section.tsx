"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CircleHelp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EChartsComposedChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-composed-chart";
import {
  buildDailyUsageHistory,
  filterCandlesByRange,
  sortCandlesAscending,
  type BillingRange,
  type ThreadBillingCandle,
} from "@/lib/billing-chart";

const RANGE_OPTIONS = ["3 months", "30 days", "14 days"] as const satisfies readonly BillingRange[];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const CHART_CONFIG = {
  session: {
    label: "Chat sessions",
    colors: {
      light: ["#626bd9"],
      dark: ["#8b93ed"],
    },
  },
  price: {
    label: "Price (₦)",
    colors: {
      light: ["#16a6a2"],
      dark: ["#4bc5c0"],
    },
  },
} satisfies ChartConfig;

const AXIS_LABEL_COLOR = "#85878e";
const GRID_LINE_COLOR = "#e7e7e9";

function brushAxisMax(extent: { min: number; max: number }) {
  const span = Math.max(
    Math.abs(extent.max - extent.min),
    Math.abs(extent.max),
    1,
  );
  return Math.ceil(extent.max + span * 0.15);
}

const CHART_OPTIONS = {
  grid: [
    { left: 48, right: 40, top: 42, bottom: 94 },
    { left: 8, right: 8, bottom: 6, height: 56, outerBoundsMode: "none" },
  ],
  yAxis: [
    {
      type: "value",
      min: 0,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: AXIS_LABEL_COLOR,
        fontSize: 10,
        formatter: (value: number) => `₦${value.toLocaleString("en-NG")}`,
      },
      splitLine: {
        show: true,
        lineStyle: { color: GRID_LINE_COLOR, type: [3, 3], width: 1 },
      },
    },
    { type: "value", gridIndex: 1, show: false, max: brushAxisMax },
    {
      type: "value",
      gridIndex: 0,
      position: "right",
      min: 0,
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: AXIS_LABEL_COLOR,
        fontSize: 10,
        formatter: (value: number) => String(value),
      },
      splitLine: { show: false },
    },
    { type: "value", gridIndex: 1, show: false, min: 0, max: brushAxisMax },
  ],
} satisfies Record<string, unknown>;

type UsageHistoryView = {
  readonly sessionCount: number;
  readonly totalSpendKobo: number;
};

const formatKobo = (value: unknown) =>
  `₦${(Number(value) / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

const formatDateTick = (value: string) => {
  const [, month, day] = value.split("-");
  return `${day} ${MONTHS[Number(month) - 1]}`;
};

export function UsageHistorySection() {
  const rawCandles = useQuery(api.billing.threadBillingCandles, {});
  const isLoading = rawCandles === undefined;

  const candles = useMemo<ThreadBillingCandle[]>(
    () =>
      (rawCandles ?? []).map((row) => ({
        ...row,
        date: new Date(row.date),
      })),
    [rawCandles],
  );

  const [selectedRange, setSelectedRange] = useState<BillingRange>("30 days");

  const filteredCandles = useMemo(
    () => filterCandlesByRange(sortCandlesAscending(candles), selectedRange),
    [candles, selectedRange],
  );

  const view = useMemo<UsageHistoryView>(
    () => ({
      sessionCount: filteredCandles.length,
      totalSpendKobo: filteredCandles.reduce(
        (sum, candle) => sum + candle.chargedKobo,
        0,
      ),
    }),
    [filteredCandles],
  );

  const chartData = useMemo(() => buildDailyUsageHistory(filteredCandles), [filteredCandles]);

  return (
    <section aria-labelledby="usage-history-heading">
      <div className="flex items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-[3px]">
          <h2
            id="usage-history-heading"
            className="m-0 h-[23px] text-[15px] leading-[23px] font-medium text-ink-soft"
          >
            Usage history
          </h2>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  aria-label="How these totals work"
                  className="inline-flex size-5 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  type="button"
                />
              }
            >
              <CircleHelp aria-hidden="true" className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent
              align="center"
              className="max-w-sm flex-col items-start gap-2 p-3 text-left"
              side="bottom"
            >
              <p className="m-0 font-medium text-background">
                How these numbers work
              </p>
              <dl className="flex flex-col gap-2 text-xs">
                <div>
                  <dt className="font-medium text-background">Chat sessions</dt>
                  <dd className="m-0 mt-0.5 text-background/80">
                    Each active chat counts as one session on the day it was
                    created or last used. Several chats started on the same day
                    count as separate sessions. Free chats are included.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-background">Total spend</dt>
                  <dd className="m-0 mt-0.5 text-background/80">
                    The naira actually charged across those sessions, from chat
                    replies and any file, spreadsheet, or browser work.
                  </dd>
                </div>
              </dl>
              <p className="m-0 text-background/80">
                “Total” means added up for the period you choose. Each bar shows
                one day’s sessions, and the line shows one day’s charges.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div
          aria-label="Usage history range"
          className="flex shrink-0 gap-1"
          role="group"
        >
          {RANGE_OPTIONS.map((range) => (
            <button
              aria-pressed={selectedRange === range}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                selectedRange === range && "bg-surface-hover text-ink-soft",
              )}
              key={range}
              onClick={() => setSelectedRange(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <Card className="mt-4 ring-0 shadow-none">
        <CardHeader>
          <div className="flex items-baseline gap-5">
            <div className="flex items-baseline gap-1">
              <span className="text-[26px] leading-8 font-medium tabular-nums tracking-tight text-ink">
                {view.sessionCount}
              </span>
              <span className="text-xs text-muted-foreground">chat sessions</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[26px] leading-8 font-medium tabular-nums tracking-tight text-ink">
                {formatKobo(view.totalSpendKobo)}
              </span>
              <span className="text-xs text-muted-foreground">total spend</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[248px] px-4 pb-4 pt-0">
          <EChartsComposedChart
            chartOptions={isLoading ? undefined : CHART_OPTIONS}
            className="h-full w-full"
            config={CHART_CONFIG}
            data={chartData}
            isLoading={isLoading}
            loadingBars={12}
            xDataKey="date"
          >
            <EChartsComposedChart.Grid />
            <EChartsComposedChart.XAxis dataKey="date" tickFormatter={formatDateTick} />
            <EChartsComposedChart.Brush formatLabel={formatDateTick} />
            <EChartsComposedChart.Legend isClickable />
            <EChartsComposedChart.Tooltip />
            <EChartsComposedChart.Bar
              barProps={{ yAxisIndex: 2 }}
              dataKey="session"
              isClickable
            />
            <EChartsComposedChart.Line dataKey="price" isClickable>
              <EChartsComposedChart.ActiveDot variant="colored-border" />
              <EChartsComposedChart.Dot variant="default" />
            </EChartsComposedChart.Line>
          </EChartsComposedChart>
        </CardContent>
      </Card>
    </section>
  );
}
