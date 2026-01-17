import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function GreetingCardPage() {
  return (
    <div className="p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Greeting Card</CardTitle>
          <CardDescription>
            A molecule combining multiple atoms into a reusable component.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This molecule uses the Card and Button atoms together.
          </p>
        </CardContent>
        <CardFooter>
          <Button>Send Greeting</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
