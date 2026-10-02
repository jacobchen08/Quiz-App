// Difficulty pips: one, two or three lit bars out of three, in the level's line colour.
// Decorative: the level's name is always written next to them.
function Pips({ count, accent }) {
  return (
    <span className={`pips accent-${accent}`} aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <span key={i} className={i < count ? 'on' : ''} />
      ))}
    </span>
  );
}

export default Pips;
