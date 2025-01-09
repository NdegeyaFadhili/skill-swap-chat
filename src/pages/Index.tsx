import { useState } from "react";
import { SkillCard } from "@/components/SkillCard";
import { SkillForm } from "@/components/SkillForm";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

const Index = () => {
  const [showForm, setShowForm] = useState(false);
  
  // Mock data for demonstration
  const mockSkills = [
    {
      title: "React Development",
      description: "Learn modern React with hooks and best practices",
      category: "Programming",
      level: "Intermediate",
    },
    {
      title: "UI/UX Design",
      description: "Master the principles of user interface design",
      category: "Design",
      level: "Advanced",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Skill Exchange</h1>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add Skill
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showForm ? (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Add Your Skill</h2>
            <SkillForm />
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockSkills.map((skill, index) => (
            <SkillCard
              key={index}
              skill={skill}
              onConnect={() => console.log("Connect clicked", skill)}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;