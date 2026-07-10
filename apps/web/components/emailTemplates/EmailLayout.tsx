import React, { ReactNode } from 'react';
import {
  Body,
  Container,
  Hr,
  Img,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import app from '@/lib/app';

interface EmailLayoutProps {
  children: ReactNode;
}

const EmailLayout = ({ children }: EmailLayoutProps) => {
  const baseUrl = app.url.startsWith('http')
    ? app.url.replace(/\/$/, '')
    : 'https://app.tivmark.com';

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: '#b08d57',
            },
          },
        },
      }}
    >
      <Body className="email-body mx-auto my-auto bg-[#f7f5f0] font-sans">
        <Container className="email-card mx-auto my-[40px] w-[465px] rounded border border-solid border-[#d8d0c0] bg-white p-[20px] text-[#2a2a2a]">
          <Section className="email-logo-panel bg-white py-4 text-center">
            <Img
              src={`${baseUrl}${app.logoUrl}`}
              width="180"
              height="63"
              alt={app.name}
              className="email-logo-light mx-auto my-4"
            />
            <Img
              src={`${baseUrl}${app.logoUrlDark}`}
              width="180"
              height="63"
              alt={app.name}
              className="email-logo-dark mx-auto my-4"
            />
          </Section>
          <Section className="email-content text-[#2a2a2a]">{children}</Section>
          <Section className="email-footer text-[#6b6b6b]">
            <Hr className="email-rule mx-0 my-[20px] w-full border border-solid border-[#d8d0c0]" />
            <Text className="my-0 text-center text-xs text-[#666666]">
              <span className="block">{app.name}</span>
            </Text>
          </Section>
        </Container>
      </Body>
    </Tailwind>
  );
};

export default EmailLayout;
