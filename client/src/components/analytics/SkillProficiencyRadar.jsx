import React from 'react';

const SkillProficiencyRadar = ({ skills = [] }) => {
  if (skills.length === 0) return null;

  // SVG radar chart dimensions
  const size = 300;
  const center = size / 2;
  const maxRadius = size / 2 - 40;
  const levels = 5;

  // Calculate points for the polygon
  const angleStep = (Math.PI * 2) / skills.length;

  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    };
  };

  // Create polygon path
  const dataPoints = skills.map((skill, index) => getPoint(index, skill.score));
  const polygonPath = dataPoints.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ') + ' Z';

  // Create grid circles
  const gridCircles = [];
  for (let i = 1; i <= levels; i++) {
    gridCircles.push((maxRadius / levels) * i);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Skill Proficiency</h3>

      <div className="flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible">
          {/* Grid circles */}
          {gridCircles.map((radius, index) => (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}

          {/* Axis lines */}
          {skills.map((skill, index) => {
            const endPoint = getPoint(index, 100);
            return (
              <line
                key={index}
                x1={center}
                y1={center}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            );
          })}

          {/* Data polygon */}
          <path
            d={polygonPath}
            fill="rgba(59, 130, 246, 0.2)"
            stroke="#3b82f6"
            strokeWidth="2"
          />

          {/* Data points */}
          {dataPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#3b82f6"
              stroke="white"
              strokeWidth="2"
            />
          ))}

          {/* Labels */}
          {skills.map((skill, index) => {
            const labelPoint = getPoint(index, 115);
            const angle = angleStep * index - Math.PI / 2;
            const adjustX = Math.cos(angle) * 10;
            const adjustY = Math.sin(angle) * 10;

            return (
              <text
                key={index}
                x={labelPoint.x + adjustX}
                y={labelPoint.y + adjustY}
                textAnchor="middle"
                className="text-xs font-medium fill-gray-700"
              >
                {skill.name}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default SkillProficiencyRadar;
