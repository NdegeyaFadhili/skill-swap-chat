import { useState } from "react";
import { SkillCard } from "@/components/SkillCard";
import { SkillForm } from "@/components/SkillForm";
import { Button } from "@/components/ui/button";
import { PlusIcon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  
  // Enhanced mock data
  const mockSkills = [
    {
      title: "React Development",
      description: "Learn modern React with hooks, state management, and best practices. Includes practical projects and real-world applications.",
      category: "Programming",
      level: "Intermediate",
    },
    {
      title: "UI/UX Design",
      description: "Master the principles of user interface design, wireframing, prototyping, and user research methodologies.",
      category: "Design",
      level: "Advanced",
    },
    {
      title: "Spanish Language",
      description: "Learn conversational Spanish from a native speaker. Focus on practical vocabulary and real-world situations.",
      category: "Language",
      level: "Beginner",
    },
    {
      title: "Digital Marketing",
      description: "Comprehensive guide to digital marketing including SEO, social media marketing, and content strategy.",
      category: "Marketing",
      level: "Expert",
    },
    {
      title: "Piano Lessons",
      description: "From basics to advanced techniques, learn piano through structured lessons and practical exercises.",
      category: "Music",
      level: "Intermediate",
    },
    {
      title: "Data Science",
      description: "Learn Python, data analysis, machine learning, and statistical modeling for data science applications.",
      category: "Programming",
      level: "Advanced",
    },
  ];

  const handleConnect = (skill: any) => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to connect with other users.",
      });
      return;
    }
    toast({
      title: "Connection Request Sent!",
      description: `You'll be notified when the instructor accepts your request to learn ${skill.title}.`,
    });
  };

  const filteredSkills = mockSkills.filter(skill =>
    skill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <AuthForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Skill Exchange</h1>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search skills..."
                  className="pl-9 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Add Skill
              </Button>
              <Button
                variant="outline"
                onClick={() => signOut()}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showForm && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Add Your Skill</h2>
            <SkillForm />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSkills.map((skill, index) => (
            <SkillCard
              key={index}
              skill={skill}
              onConnect={() => handleConnect(skill)}
            />
          ))}
        </div>

        {filteredSkills.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500">No skills found matching your search.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;