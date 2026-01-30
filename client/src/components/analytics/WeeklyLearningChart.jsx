import React, { useState } from 'react';

const WeeklyLearningChart = ({ data = [] }) => {
  const [timeframe, setTimeframe] = useState('7days');

  // Get max hours for scaling
  const maxHours = Math.max(...data.map(d => d.hours), 10);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Weekly Learning Hours</h3>
          <p className="text-sm text-gray-500">Average engagement time per day</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeframe('7days')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              timeframe === '7days'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeframe('30days')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              timeframe === '30days'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-48">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-xs text-gray-400">
          <span>{maxHours}h</span>
          <span>{Math.round(maxHours / 2)}h</span>
          <span>0h</span>
        </div>

        {/* Bars */}
        <div className="ml-8 h-full flex items-end justify-between gap-2">
          {data.map((item, index) => {
            const height = ((item.hours / maxHours) * 100) || 0;
            const isWeekend = item.day === 'Sat' || item.day === 'Sun';

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                {/* Bar */}
                <div className="w-full relative group">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isWeekend ? 'bg-blue-200' : 'bg-blue-600'
                    } hover:bg-blue-700`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  >
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap transition-opacity">
                      {item.hours}h
                    </div>
                  </div>
                </div>

                {/* Day label */}
                <span className="text-xs text-gray-500 font-medium">{item.day}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklyLearningChart;
