import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";
import AuthMark from "@/components/AuthMark";

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Log 404 errors for debugging
    console.log(`404 Error: Route "${location.pathname}" not found`);
  }, [location.pathname]);

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo and Title */}
        <div className="flex justify-center mb-8">
          <BrandLogo className="h-16 w-16" />
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h.013M12 19v6m-7 0h-6.938M19 19H12"
                />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">404</h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
          
          <p className="text-gray-600 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>

          {/* Current Path Display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <p className="text-sm font-mono text-gray-700 mb-2">
              <strong>Requested Path:</strong> {location.pathname}
            </p>
            <p className="text-xs text-gray-600">
              This could be a typo, broken link, or the page may have been removed.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleGoHome}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Go to Dashboard
            </Button>
            
            <Button
              onClick={handleGoBack}
              variant="outline"
              className="w-full"
            >
              Go Back
            </Button>
          </div>

          {/* Help Section */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Need Help?</h3>
            <p className="text-sm text-blue-800 mb-3">
              Try these popular pages:
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <a
                href="/dashboard"
                className="flex items-center p-2 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-100 transition-colors"
              >
                📊 Dashboard
              </a>
              <a
                href="/menu"
                className="flex items-center p-2 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-100 transition-colors"
              >
                📋 Menu
              </a>
              <a
                href="/send"
                className="flex items-center p-2 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-100 transition-colors"
              >
                💸 Send Money
              </a>
              <a
                href="/ai"
                className="flex items-center p-2 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-100 transition-colors"
              >
                🤖 OpenPay AI
              </a>
            </div>
          </div>

          {/* AI Assistant Suggestion */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
            <h3 className="text-sm font-semibold text-purple-900 mb-2">🤖 Ask OpenPay AI</h3>
            <p className="text-sm text-purple-800 mb-3">
              Tell our AI assistant where you want to go:
            </p>
            <div className="bg-white rounded p-3 border border-purple-200">
              <code className="text-xs text-purple-700">
                Try saying: "take me to dashboard" or "open wallet"
              </code>
            </div>
            <Button
              onClick={() => navigate('/ai')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-3"
            >
              Chat with AI Assistant
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
