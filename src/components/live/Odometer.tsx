/**
 * Scoreboard-style number: each digit rolls to its new value.
 * Digits are keyed from the right, so ₹9.90 -> ₹10.00 rolls the existing
 * digits and only adds one on the left.
 */
export function Odometer({ text, className = '' }: { text: string; className?: string }) {
  const chars = [...text];
  return (
    <span className={'odo ' + className} aria-label={text} role="text">
      {chars.map((c, i) => {
        const key = chars.length - i;
        if (!/\d/.test(c)) {
          return (
            <span key={'s' + key} className="odo-sym" aria-hidden>
              {c === ' ' ? ' ' : c}
            </span>
          );
        }
        return (
          <span key={'d' + key} className="odo-digit" aria-hidden>
            <span className="odo-strip" style={{ transform: `translateY(${-Number(c) * 10}%)` }}>
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
