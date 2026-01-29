import React from "react";

export const Services = (props) => {
  return (
    <div id="services" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-display font-bold text-gray-900 mb-4">
            Our Services
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Personalized career support designed to build skills, explore paths, and achieve professional goals.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {props.data
            ? props.data.map((d, i) => (
              <div
                key={`${d.name}-${i}`}
                className="group bg-white rounded-2xl p-8 shadow-soft hover:shadow-hard 
                           transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
              >
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-xl 
                                bg-gradient-to-br from-primary-500 to-accent-500 text-white
                                group-hover:scale-110 transition-transform duration-300">
                  <i className={`${d.icon} text-3xl`}></i>
                  </div>

                {/* Service Name */}
                <h3 className="text-2xl font-semibold text-gray-900 mb-4 group-hover:text-primary-700 transition-colors">
                  {d.name}
                </h3>

                {/* Service Description */}
                <p className="text-gray-600 leading-relaxed">
                  {d.text}
                </p>
                </div>
              ))
            : "loading"}
        </div>
      </div>
    </div>
  );
};
