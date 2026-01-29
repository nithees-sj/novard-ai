import React from "react";

export const Features = (props) => {
  return (
    <div id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl sm:text-5xl font-display font-bold text-gray-900 mb-4">
            Features
          </h2>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {props.data
            ? props.data.map((d, i) => (
              <div
                key={`${d.title}-${i}`}
                className="group text-center p-6 rounded-xl hover:bg-gradient-to-br hover:from-primary-50 hover:to-accent-50 
                           transition-all duration-300 hover:shadow-soft transform hover:-translate-y-1"
              >
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-primary-100 
                                text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300
                                group-hover:scale-110">
                  <i className={`${d.icon} text-2xl`}></i>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary-700 transition-colors">
                  {d.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed">
                  {d.text}
                </p>
                </div>
              ))
            : "Loading..."}
        </div>
      </div>
    </div>
  );
};
