import React from 'react';

const Card = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="card w-full rounded-none border border-ui-border bg-ui-surface text-ui-text">
      {children}
    </div>
  );
};

const Title = ({ children }: { children: React.ReactNode }) => {
  return (
    <h2 className="card-title font-serif text-xl font-normal leading-none tracking-tight text-ui-heading">
      {children}
    </h2>
  );
};

const Description = ({ children }: { children: React.ReactNode }) => {
  return <div className="text-sm text-ui-muted">{children}</div>;
};

const Header = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex gap-2 flex-col">{children}</div>;
};

const Body = ({ children }: { children: React.ReactNode }) => {
  return <div className="card-body gap-4 p-6">{children}</div>;
};

const Footer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="card-actions justify-end border-t border-ui-border bg-ui-surface-muted p-2">
      {children}
    </div>
  );
};

Card.Body = Body;
Card.Title = Title;
Card.Description = Description;
Card.Header = Header;
Card.Footer = Footer;

export default Card;
