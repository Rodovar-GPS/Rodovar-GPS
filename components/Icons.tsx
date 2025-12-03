import React from 'react';

export const TruckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

export const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

export const MapPinIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

export const SteeringWheelIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
  </svg>
);

export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.968.585 1.972.89 2.796.89 3.183 0 5.769-2.587 5.769-5.766 0-3.181-2.585-5.767-5.769-5.767zm.92 8.854c-.166.029-1.432.28-1.626.33-.193.049-1.062.411-1.31.576-.192.128-1.233.86-1.388 2.017-.163 1.211 1.401 4.158 3.276 5.66 2.507 2.011 4.983 2.453 5.733 1.879.639-.49 1.217-1.934 1.272-2.259.054-.326.022-.566-.098-.662-.12-.097-1.891-1.188-2.07-1.188-.18 0-.406.049-.546.234-.14.185-.596.662-.69.77-.095.108-.213.118-.356.059-.142-.059-1.669-.789-2.665-1.996-.364-.441-.019-.637.145-.811.125-.132.316-.354.436-.519.12-.165.157-.264.239-.429.081-.164.036-.355-.045-.519-.082-.164-.699-1.684-.915-2.28-.194-.536-.454-.507-.616-.516-.146-.009-.316-.009-.485-.009-.169 0-.445.067-.678.326-.233.26-1.151 1.118-1.151 2.724 0 1.606 1.188 3.157 1.376 3.376.187.218 2.484 4.209 6.126 5.733 2.53 1.058 3.387.923 3.974.813.587-.11 1.891-.789 2.171-1.548.28-.759.28-1.407.198-1.548-.082-.141-.306-.234-.639-.405zM12 2.163c5.497 0 9.969 4.471 9.969 9.968 0 5.497-4.472 9.969-9.969 9.969-5.497 0-9.969-4.472-9.969-9.969 0-5.497 4.472-9.968 9.969-9.968z"/>
  </svg>
);