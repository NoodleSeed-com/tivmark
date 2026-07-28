import { updateTeamApiSchema } from '../../lib/zod';

describe('Lib - zod', () => {
  describe('updateTeamApiSchema', () => {
    it('normalizes a team slug before it is persisted', () => {
      const result = updateTeamApiSchema.parse({
        slug: 'new team example',
      });

      expect(result.slug).toBe('new-team-example');
    });
  });
});
