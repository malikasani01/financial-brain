/**
 * Foundational money & time primitives.
 *
 * RULE: all money in this system is an INTEGER number of cents. Never a float.
 * Formatting to dollars happens only at the view layer.
 *
 * RULE: the engine is pure. "Now" is never read from the system clock inside a
 * calculation — it is injected as a {@link Clock}. This is what makes every
 * engine function deterministic and trivially unit-testable.
 */

/** An integer number of cents. `1234` === $12.34. Negative allowed (outflows/debts). */
export type Cents = number;

/** A calendar date in the user's local timezone, formatted 'YYYY-MM-DD'. */
export type ISODate = string;

/**
 * The injected notion of "now". Every pure engine function that needs the
 * current date takes a Clock rather than calling Date.now().
 */
export interface Clock {
  /** Today's date in the user's local timezone, 'YYYY-MM-DD'. */
  today: ISODate;
  /** IANA timezone id, e.g. 'America/Denver'. */
  timezone: string;
}
