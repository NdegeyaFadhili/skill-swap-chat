import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SkillCardProps {
  skill: {
    title: string;
    description: string;
    category: string;
    level: string;
  };
  onConnect: () => void;
}

export const SkillCard = ({ skill, onConnect }: SkillCardProps) => {
  return (
    <Card className="w-full max-w-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold">{skill.title}</CardTitle>
            <CardDescription className="mt-1">{skill.category}</CardDescription>
          </div>
          <Badge variant="secondary">{skill.level}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 mb-4">{skill.description}</p>
        <Button onClick={onConnect} className="w-full bg-primary hover:bg-primary/90">
          Connect & Learn
        </Button>
      </CardContent>
    </Card>
  );
};