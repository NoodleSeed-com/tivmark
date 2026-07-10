import {
  Button,
  Container,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import EmailLayout from './EmailLayout';
import { Team } from '@prisma/client';
import app from '@/lib/app';
import EmailHead from './EmailHead';

interface TeamInviteEmailProps {
  team: Team;
  invitationLink: string;
  subject: string;
}

const TeamInviteEmail = ({
  team,
  invitationLink,
  subject,
}: TeamInviteEmailProps) => {
  return (
    <Html>
      <EmailHead />
      <Preview>{subject}</Preview>
      <EmailLayout>
        <Text>
          You have been invited to join the {team.name} team on {app.name}.
        </Text>
        <Text>
          Click the button below to accept the invitation and join the team.
        </Text>
        <Container className="text-center">
          <Button
            href={invitationLink}
            className="bg-brand text-white font-medium py-2 px-4 rounded"
          >
            Join the team
          </Button>
        </Container>
        <Text>
          You have 7 days to accept this invitation before it expires.
        </Text>
      </EmailLayout>
    </Html>
  );
};

export default TeamInviteEmail;
