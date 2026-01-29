import React from "react";
import { FaLinkedin } from "react-icons/fa";

export const Team = (props) => {
  return (
    <div id="team" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-display font-bold text-gray-900 mb-4">
            Meet the Team
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Get to know the dedicated team guiding you toward personalized career success.
          </p>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {props.data
            ? props.data.map((d, i) => (
              <div
                key={`${d.name}-${i}`}
                className="group text-center"
              >
                {/* Image Container */}
                <div className="relative mb-4 overflow-hidden rounded-2xl aspect-square">
                  <img
                    src={d.img}
                    alt={d.name}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Name */}
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {d.name}
                </h4>

                {/* LinkedIn */}
                {d.linkedin && (
                  <a
                    href={d.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 
                               text-[#0077b5] hover:bg-[#0077b5] hover:text-white transition-all duration-300
                               hover:scale-110 transform"
                    aria-label={`${d.name}'s LinkedIn`}
                  >
                    <FaLinkedin size={20} />
                  </a>
                )}
                </div>
              ))
            : "loading"}
        </div>
      </div>
    </div>
  );
};
