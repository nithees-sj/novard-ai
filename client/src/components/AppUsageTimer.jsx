import React, { useState, useEffect } from 'react';

const AppUsageTimer = () => {
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [totalTodayMinutes, setTotalTodayMinutes] = useState(0);

  useEffect(() => {
    // Track session start time
    const sessionStart = Date.now();
    
    // Load today's total from localStorage
    const today = new Date().toDateString();
    const storedData = JSON.parse(localStorage.getItem('appUsageData') || '{}');
    
    if (storedData.date === today) {
      setTotalTodayMinutes(storedData.minutes || 0);
    } else {
      // New day, reset
      localStorage.setItem('appUsageData', JSON.stringify({ date: today, minutes: 0 }));
      setTotalTodayMinutes(0);
    }

    // Update every minute
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStart) / 60000);
      setSessionMinutes(elapsed);
      
      // Update today's total
      const currentData = JSON.parse(localStorage.getItem('appUsageData') || '{}');
      if (currentData.date === today) {
        const newTotal = (currentData.minutes || 0) + 1;
        localStorage.setItem('appUsageData', JSON.stringify({ date: today, minutes: newTotal }));
        setTotalTodayMinutes(newTotal);
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  // Calculate progress (max 240 minutes = 4 hours for visual representation)
  const maxMinutes = 240;
  const progress = Math.min((totalTodayMinutes / maxMinutes) * 100, 100);
  
  // Determine number of filled dots (max 10 dots)
  const totalDots = 10;
  const filledDots = Math.floor((totalTodayMinutes / maxMinutes) * totalDots);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      {/* Clock Icon */}
      <div className="text-blue-600">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Time Display */}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-gray-900">{totalTodayMinutes}</span>
          <span className="text-xs text-gray-600">min today</span>
        </div>
        
        {/* Progress Dots */}
        <div className="flex gap-1 mt-1">
          {[...Array(totalDots)].map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                index < filledDots
                  ? 'bg-blue-600 scale-110'
                  : 'bg-gray-300'
              }`}
              title={`${((index + 1) / totalDots * maxMinutes).toFixed(0)} min`}
            />
          ))}
        </div>
      </div>

      {/* Progress Bar (Linear alternative) */}
      <div className="hidden md:flex flex-col ml-2">
        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500 mt-0.5">
          {sessionMinutes}m session
        </span>
      </div>
    </div>
  );
};

export default AppUsageTimer;
