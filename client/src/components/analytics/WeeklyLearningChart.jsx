import React, { useState, useEffect } from 'react';

const WeeklyLearningChart = ({ data = [] }) => {
  const [timeframe, setTimeframe] = useState('7days');
  const [todayMinutes, setTodayMinutes] = useState(0);

  useEffect(() => {
    // Load today's usage from localStorage
    const today = new Date().toDateString();
    const storedData = JSON.parse(localStorage.getItem('appUsageData') || '{}');

    if (storedData.date === today) {
      setTodayMinutes(storedData.minutes || 0);
    }

    // Update every minute
    const interval = setInterval(() => {
      const currentData = JSON.parse(localStorage.getItem('appUsageData') || '{}');
      if (currentData.date === today) {
        setTodayMinutes(currentData.minutes || 0);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Get max minutes for scaling
  const maxMinutes = Math.max(...data.map(d => d.hours * 60), 60); // Convert hours to minutes

  // Calculate today's progress (max 240 minutes = 4 hours)
  const goalMinutes = 240;
  const progress = Math.min((todayMinutes / goalMinutes) * 100, 100);
  const totalDots = 10;
  const filledDots = Math.floor((todayMinutes / goalMinutes) * totalDots);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Weekly Learning Minutes</h3>
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

      {/* Today's Usage - Compact Inline Indicator */}
      <div className="mb-4 flex items-center justify-between bg-blue-50/50 rounded-lg px-4 py-2.5 border border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-gray-600">Today's Usage</span>
        </div>

        {/* Progress Dots */}
        <div className="flex gap-1 flex-1 mx-4 max-w-md">
          {[...Array(totalDots)].map((_, index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${index < filledDots
                  ? 'bg-blue-600'
                  : 'bg-gray-200'
                }`}
              title={`${((index + 1) / totalDots * goalMinutes).toFixed(0)} min milestone`}
            />
          ))}
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold text-gray-900">{todayMinutes}</span>
          <span className="text-xs text-gray-500">min</span>
          <span className="text-xs font-medium text-blue-600 ml-2">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-48">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-xs text-gray-400">
          <span className="font-bold">{Math.round(maxMinutes)}m</span>
          <span className="font-bold">{Math.round(maxMinutes / 2)}m</span>
          <span className="font-bold">0m</span>
        </div>

        {/* Bars */}
        <div className="ml-10 h-full flex items-end justify-between gap-2">
          {data.map((item, index) => {
            const minutes = Math.round(item.hours * 60); // Convert hours to minutes
            const height = ((minutes / maxMinutes) * 100) || 0;
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
                      <span className="font-bold">{minutes}</span> minutes
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

