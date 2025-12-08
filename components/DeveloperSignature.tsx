import React from 'react';

const DeveloperSignature: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 w-full z-[100] p-3 md:p-4 pointer-events-none flex justify-center">
      <div className="bg-[#0055a4] text-white text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-blue-400/30 backdrop-blur-md select-none">
        Desarrollado por G. BISCOTTI
      </div>
    </div>
  );
};

export default DeveloperSignature;