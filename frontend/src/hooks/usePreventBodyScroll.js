import { useEffect } from 'react';

/**
 * Custom hook to prevent body scrolling when a modal is open
 * @param {boolean} isOpen - Whether the modal is open or not
 */
const usePreventBodyScroll = (isOpen) => {
  useEffect(() => {
    if (isOpen) {
      // Save current overflow value
      const originalOverflow = document.body.style.overflow;
      
      // Disable body scroll
      document.body.style.overflow = 'hidden';

      // Cleanup function to restore original overflow
      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
      };
    }
  }, [isOpen]);
};

export default usePreventBodyScroll;

