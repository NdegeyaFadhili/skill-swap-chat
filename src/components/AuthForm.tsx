
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthError } from "@supabase/supabase-js";

export const AuthForm = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);
    
    try {
      if (isSignUp) {
        await signUp(email, password);
        toast({
          title: "Account created successfully!",
          description: "Please check your email to verify your account.",
        });
      } else {
        await signIn(email, password);
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
      }
    } catch (error) {
      console.error("Auth error:", error);
      
      const authError = error as AuthError;
      let errorMessage = "An unexpected error occurred";
      
      if (authError.message?.includes("Email not confirmed")) {
        errorMessage = "Please verify your email address before signing in.";
      } else if (authError.message?.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (authError.message) {
        errorMessage = authError.message;
      }
      
      setAuthError(errorMessage);
      
      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-4 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center">
        {isSignUp ? "Create an Account" : "Sign In"}
      </h2>
      
      {authError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{authError}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            placeholder="your@email.com"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
        </Button>
      </form>
      
      {isSignUp && (
        <p className="text-sm text-center text-gray-600">
          By signing up, you'll receive a verification email.
          Please check your inbox and verify your account before signing in.
        </p>
      )}
      
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          setIsSignUp(!isSignUp);
          setAuthError(null);
        }}
        disabled={isLoading}
      >
        {isSignUp
          ? "Already have an account? Sign In"
          : "Don't have an account? Sign Up"}
      </Button>
    </div>
  );
};
