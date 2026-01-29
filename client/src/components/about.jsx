import React from "react";

export const About = (props) => {
  return (
    <div id="about" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Image */}
          <div className="animate-fade-in">
            <img
              src="img/about.jpg"
              className="w-full h-auto rounded-2xl shadow-medium object-cover hover:shadow-hard transition-shadow duration-300"
              alt="About Us"
            />
          </div>

          {/* Content */}
          <div className="animate-slide-up">
            <h2 className="text-4xl font-display font-bold text-gray-900 mb-6">
              About Us
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              {props.data ? props.data.paragraph : "loading..."}
            </p>

            <h3 className="text-2xl font-semibold text-gray-900 mb-6">
              Why Choose Us?
            </h3>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* First Column */}
              <ul className="space-y-3">
                {props.data
                  ? props.data.Why.map((d, i) => (
                    <li key={`${d}-${i}`} className="flex items-start">
                      <svg
                        className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-700">{d}</span>
                    </li>
                  ))
                  : "loading"}
              </ul>

              {/* Second Column */}
              <ul className="space-y-3">
                {props.data
                  ? props.data.Why2.map((d, i) => (
                    <li key={`${d}-${i}`} className="flex items-start">
                      <svg
                        className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-700">{d}</span>
                    </li>
                  ))
                  : "loading"}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
