import { describe, expect, it } from 'vitest';

import { canTransition } from '../partner-state-machine';

describe('canTransition', () => {
  describe('valid transitions', () => {
    it('responder can accept a pending request', () => {
      expect(
        canTransition({
          currentStatus: 'pending',
          targetStatus: 'accepted',
          role: 'responder',
        })
      ).toBe(true);
    });

    it('responder can decline a pending request', () => {
      expect(
        canTransition({
          currentStatus: 'pending',
          targetStatus: 'declined',
          role: 'responder',
        })
      ).toBe(true);
    });

    it('requester can cancel a pending request', () => {
      expect(
        canTransition({
          currentStatus: 'pending',
          targetStatus: 'removed',
          role: 'requester',
        })
      ).toBe(true);
    });

    it('responder can cancel a pending request', () => {
      expect(
        canTransition({
          currentStatus: 'pending',
          targetStatus: 'removed',
          role: 'responder',
        })
      ).toBe(true);
    });

    it('requester can remove an accepted partnership', () => {
      expect(
        canTransition({
          currentStatus: 'accepted',
          targetStatus: 'removed',
          role: 'requester',
        })
      ).toBe(true);
    });

    it('responder can remove an accepted partnership', () => {
      expect(
        canTransition({
          currentStatus: 'accepted',
          targetStatus: 'removed',
          role: 'responder',
        })
      ).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('requester cannot accept a pending request', () => {
      expect(
        canTransition({
          currentStatus: 'pending',
          targetStatus: 'accepted',
          role: 'requester',
        })
      ).toBe(false);
    });

    it('requester cannot decline a pending request', () => {
      expect(
        canTransition({
          currentStatus: 'pending',
          targetStatus: 'declined',
          role: 'requester',
        })
      ).toBe(false);
    });

    it('cannot transition from declined', () => {
      expect(
        canTransition({
          currentStatus: 'declined',
          targetStatus: 'accepted',
          role: 'responder',
        })
      ).toBe(false);
    });

    it('cannot transition from removed', () => {
      expect(
        canTransition({
          currentStatus: 'removed',
          targetStatus: 'accepted',
          role: 'responder',
        })
      ).toBe(false);
    });

    it('cannot transition from removed to pending', () => {
      expect(
        canTransition({
          currentStatus: 'removed',
          targetStatus: 'pending',
          role: 'requester',
        })
      ).toBe(false);
    });

    it('cannot go from accepted back to pending', () => {
      expect(
        canTransition({
          currentStatus: 'accepted',
          targetStatus: 'pending',
          role: 'requester',
        })
      ).toBe(false);
    });
  });
});
