import React from 'react';

const StrengthsWeaknesses = ({ strengths = [] }) => {
  const getLevelColor = (level) => {
    switch (level) {
      case 'Expert':
        return 'bg-green-500';
      case 'Advanced':
        return 'bg-blue-500';
      case 'Intermediate':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getLevelBadgeColor = (level) => {
    switch (level) {
      case 'Expert':
        return 'bg-green-100 text-green-700';
      case 'Advanced':
        return 'bg-blue-100 text-blue-700';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Strengths & Weaknesses</h3>

      <div className="space-y-4">
        {strengths.map((strength, index) => (
          <div key={index}>
            {/* Skill name and percentage */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">{strength.name}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getLevelBadgeColor(strength.level)}`}>
                  {strength.level}
                </span>
                <span className="text-sm font-bold text-gray-900">{strength.percentage}%</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${getLevelColor(strength.level)}`}
                style={{ width: `${strength.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StrengthsWeaknesses;
