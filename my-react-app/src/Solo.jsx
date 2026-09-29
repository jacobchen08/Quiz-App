import { useState, useMemo } from 'react';
import { questionsUrl } from './api';
import Settings from './components/Settings';
import QuestionCard from './components/QuestionCard';
import FlapText from './components/FlapText';
import Icon from './components/Icon';

function Solo({ settings, onSettingsChange }) {
  const [category, setCategory] = useState([]);
  const [correctAnswer, setAnswer] = useState([]);
  const [incorrectAnswers, setIncorrect] = useState([]);
  const [questions, setQuestions] = useState([]); // Questions
  const [type, setType] = useState([]); // Question types (multiple or boolean)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // question index -> answer the user picked
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  //randomizes order of answers for multiple choice questions
  const currentOptions = useMemo(() => {
    if (questions.length === 0) return [];

    return type[currentIndex] === 'multiple'
      ? [correctAnswer[currentIndex], ...(incorrectAnswers[currentIndex] || [])]
          .sort(() => Math.random() - 0.5)
      : ['True', 'False'];
  }, [currentIndex, questions]); // Only recalculates when currentIndex or questions change

  function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prevIndex) => prevIndex + 1);
    }
  }

  function previousQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex((curr) => curr - 1);
    }
  }

  function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }

  function handleAnswerSelection(selectedAnswer) {
    if (selectedAnswer === correctAnswer[currentIndex]) {
      setScore((prevScore) => prevScore + 1);
    }
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: selectedAnswer }));
  }

  function buttonCall() {
    setLoading(true);
    setError('');

    fetch(questionsUrl(settings))
      .then((response) => response.json())
      .then((data) => {
        if (!Array.isArray(data)) throw new Error(data.error || 'Failed to fetch questions');

        // Extract decoded question strings
        const questionTexts = data.map((item) => decodeHtml(item.question));
        const categories = data.map((item) => decodeHtml(item.category));
        const correctAnswers = data.map((item) => decodeHtml(item.correct_answer));
        const incorrectAnswers = data.map((item) => item.incorrect_answers.map(ans => decodeHtml(ans)));
        const types = data.map((item) => item.type);

        setQuestions(questionTexts);
        setCategory(categories);
        setAnswer(correctAnswers);
        setIncorrect(incorrectAnswers);
        setType(types);
        setCurrentIndex(0);
        setScore(0);
        setSelectedAnswers({});
      })
      .catch((error) => {
        console.error('Error:', error);
        setError(error.message === 'Failed to fetch' ? 'Could not reach the server.' : error.message);
      })
      .finally(() => setLoading(false));
  }

  // One mark per question for the step row: correct, wrong or not answered yet
  const marks = questions.map((_, i) =>
    selectedAnswers[i] === undefined ? undefined : selectedAnswers[i] === correctAnswer[i] ? 'correct' : 'wrong'
  );

  return (
    <>
      <section className="board" aria-labelledby="solo-settings-title">
        <div className="board-head">
          <h2 className="board-title" id="solo-settings-title">Quiz settings</h2>
        </div>
        <div className="board-body">
          <Settings settings={settings} onChange={onSettingsChange} />
          <div className="board-actions">
            <button className="btn btn-primary" onClick={buttonCall} disabled={loading}>
              {loading ? 'Loading…' : questions.length > 0 ? 'Generate New Questions' : 'Generate Questions'}
            </button>
          </div>
          {error && <p className="error" role="alert"><Icon name="alert" />{error}</p>}
        </div>
      </section>

      {questions.length > 0 ? (
        <QuestionCard
          index={currentIndex}
          total={questions.length}
          category={category[currentIndex]}
          question={questions[currentIndex]}
          options={currentOptions}
          picked={selectedAnswers[currentIndex]}
          correctAnswer={correctAnswer[currentIndex]}
          score={score}
          marks={marks}
          onAnswer={handleAnswerSelection}
          onPrevious={previousQuestion}
          onNext={nextQuestion}
          onJump={setCurrentIndex}
        />
      ) : (
        <section className="board board-idle">
          <div className="board-body">
            <FlapText text="" length={10} label="" size="lg" />
            <p>Click "Generate Questions" to begin.</p>
          </div>
        </section>
      )}
    </>
  );
}

export default Solo;
