import { NextRequest, NextResponse } from "next/server";
import { getAnalytics, list } from "@/lib/records";

/**
 * GET /api/analytics
 * Return analytics stats about records and usage patterns
 */
export async function GET(_request: NextRequest) {
  try {
    const analytics = getAnalytics();
    const recentRecords = list(100); // Last 100 records for trend analysis

    // Calculate query frequency (queries per day over the last 7 days)
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * oneDay;

    const recentQueries = recentRecords.filter((r) => r.timestamp >= sevenDaysAgo);
    const queriesPerDay = recentQueries.length > 0
      ? Math.round((recentQueries.length / 7) * 100) / 100
      : 0;

    // Provider usage distribution
    const totalRecords = recentRecords.length;
    const providerDistribution: Record<string, { count: number; percentage: number }> = {};
    
    Object.entries(analytics.providerUsage).forEach(([provider, count]) => {
      providerDistribution[provider] = {
        count,
        percentage: totalRecords > 0 ? Math.round((count / totalRecords) * 1000) / 10 : 0,
      };
    });

    // Cache hit rate estimation (records with score > 0.8 considered high quality/cache hit)
    const highQualityRecords = recentRecords.filter((r) => r.score >= 0.8).length;
    const cacheHitRate = totalRecords > 0
      ? Math.round((highQualityRecords / totalRecords) * 1000) / 10
      : 0;

    // Storage utilization
    const storageUtilization = Math.round(
      (analytics.totalRecords / analytics.maxRecords) * 1000
    ) / 10;

    return NextResponse.json({
      summary: {
        totalRecords: analytics.totalRecords,
        maxRecords: analytics.maxRecords,
        storageUtilization: `${storageUtilization}%`,
        queriesPerDay,
        cacheHitRate: `${cacheHitRate}%`,
        averageScore: analytics.averageScore,
        ttlDays: analytics.ttlDays,
      },
      providerUsage: providerDistribution,
      trends: {
        oldestRecord: analytics.oldestRecord,
        newestRecord: analytics.newestRecord,
        timeSpanDays: analytics.oldestRecord && analytics.newestRecord
          ? Math.round((analytics.newestRecord - analytics.oldestRecord) / oneDay)
          : 0,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to generate analytics" },
      { status: 500 }
    );
  }
}
