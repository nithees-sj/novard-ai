import React from 'react';

const AnalyticsCard = ({ title, value, subtitle, icon, trend, trendColor = 'text-green-600', iconBg = 'bg-blue-50', iconColor = 'text-blue-600' }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">{title}</span>
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
          <span className={`text-xl ${iconColor}`}>{icon}</span>
        </div>
      </div>

      {/* Value */}
      <div className="mb-2">
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
      </div>

      {/* Subtitle and Trend */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{subtitle}</span>
        {trend && (
          <span className={`text-xs font-semibold ${trendColor}`}>{trend}</span>
        )}
      </div>
    </div>
  );
};

export default AnalyticsCard;
