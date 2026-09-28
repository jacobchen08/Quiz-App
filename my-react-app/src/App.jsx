import './App.css';
import { useState, useMemo } from 'react';
import { useEffect } from 'react';

// start localhost 8000 in apicall.py
// cd my-react-app
// npm run dev

//to do list: make the user be able to change the number of questions, difficulty, and category of questions. Make the user be able to select the correct answer and see if they are right or wrong. Make the user be able to see their score at the end of the quiz. Make the user be able to restart the quiz.



function App() {
  const [category, setCategory] = useState([]);
  const [correctAnswer, setAnswer] = useState([]);
  const [difficulty, setDifficulty] = useState([]);
  const [incorrectAnswers, setIncorrect] = useState([]);
  const [questions, setQuestions] = useState([]); // Questions
  const [type, setType] = useState([]); // Question types (multiple or boolean)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0); // New state for score
  const [answeredQuestions, setAnsweredQuestions] = useState([]); // Contains indexes of answered questions
  const [selectedAnswers, setSelectedAnswers] = useState({}); // question index -> answer the user picked
  const [loading, setLoading] = useState(false);

  const [numQuestions, setNumQuestions] = useState(10) //already works
  const [commonCategory, setCommonCategory] = useState() //to be implemented
  const [commonType, setCommonType] = useState() //to be implemented
  const [commonDifficulty, setCommonDifficulty] = useState() //to be implemented

  //randomizes order of answers for multiple choice questions
  const currentOptions = useMemo(() => {
    if (questions.length === 0) return [];

    return type[currentIndex] === 'multiple'
      ? [correctAnswer[currentIndex], ...(incorrectAnswers[currentIndex] || [])]
          .sort(() => Math.random() - 0.5)
      : ['True', 'False'];
  }, [currentIndex, questions]); // Only recalculates when currentIndex or questions change

  useEffect(() => {
    setCat(commonCategory);
    setDiff(commonDifficulty);
    setTyp(commonType);
  }, [commonCategory, commonType, commonDifficulty]);

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
    setAnsweredQuestions((prev) => [...prev, currentIndex]); // Mark the question as answered
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: selectedAnswer }));
  }

  function buttonCall() {
    setLoading(true);

    fetch('http://localhost:8000/questions')
      .then((response) => response.json())
      .then((data) => {
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
        console.log(data);
        setScore(0);
        setAnsweredQuestions([]);
        setSelectedAnswers({});
      })
      .catch((error) => console.error('Error:', error))
      .finally(() => setLoading(false));
  }

  function setCat(category_number){
    fetch(`http://localhost:8000/category?category_num=${category_number}`)
      .then((res) => res.json())
      .then((data) => console.log(data))
      .catch((err) => console.error(err));
  }
  function setDiff(difficultyLevel){
    fetch(`http://localhost:8000/difficulty?diff=${difficultyLevel}`)
    .then((res) => res.json())
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
  }
  function setTyp(questionType){
    fetch(`http://localhost:8000/type?type=${questionType}`)
    .then((res) => res.json())
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
  }
  function setCount(num){
    fetch(`http://localhost:8000/count?num=${num}`)
    .then((res) => res.json())
    .then((data) => console.log(data))
    .catch((err) => console.error(err));
  }


  

  const [categoryMap, setCategoryMap] = useState({
    "Any Category": "all",
    "General Knowledge": 9,
    "Entertainment: Books": 10,
    "Entertainment: Film": 11,
    "Entertainment: Music": 12,
    "Entertainment: Musicals and Theaters": 13,
    "Entertainment: Television": 14,
    "Entertainment: Video Games": 15,
    "Entertainment: Board Games": 16,
    "Science & Nature" : 17,
    "Science: Computers" : 18,
    "Science: Mathematics" : 19,
    "Mythology" : 20,
    "Sports" : 21,
    "Geography" : 22,
    "History" : 23,
    "Politics" : 24,
    "Art" : 25,
    "Celebrities" : 26,
    "Animals"  : 27,
    "Vehicles" : 28,
    "Entertainment: Comics" : 29,
    "Science: Gadgets" : 30,
    "Entertainment: Japanese Anime & Manga": 31,
    "Entertainment: Cartoon & Animations" : 32
  })





//category, difficultyLevel, questionType should be drop down menus and should include all, which is the default
  const isAnswered = answeredQuestions.includes(currentIndex);
  const picked = selectedAnswers[currentIndex];
  const options = type[currentIndex] === 'multiple' ? currentOptions : ['True', 'False'];
  const progress = questions.length ? (answeredQuestions.length / questions.length) * 100 : 0;

  function answerClass(option) {
    if (!isAnswered) return 'answer';
    if (option === correctAnswer[currentIndex]) return 'answer correct';
    if (option === picked) return 'answer wrong';
    return 'answer dimmed';
  }

  return (
    <div className="App">
      <header className="header">
        <h1>Quiz App</h1>
        <p>Pick your settings, generate a quiz, and test what you know.</p>
      </header>

      <section className="card">
        <h2 className="card-title">Quiz settings</h2>
        <div className="settings-grid">
          <div className="field">
            <label htmlFor="num-questions">Number of questions (1–50)</label>
            <div className="count-row">
              <input
                id="num-questions"
                type="number"
                value={numQuestions}
                min="1"
                max="50"
                onChange={(e) => setNumQuestions(e.target.value)}
              />
              <button className="btn" onClick={() => setCount(numQuestions)}>Set</button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" value={commonCategory} onChange={(e) => setCommonCategory(e.target.value)}>
              <option value="">Any Category</option>
              {Object.entries(categoryMap).map(([category, id]) => (
                <option key={id} value={id}>{category}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="difficulty">Difficulty</label>
            <select id="difficulty" value={commonDifficulty} onChange={(e) => setCommonDifficulty(e.target.value)}>
              <option value="">Any Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="type">Question type</label>
            <select id="type" value={commonType} onChange={(e) => setCommonType(e.target.value)}>
              <option value="">Any Question Type</option>
              <option value="multiple">Multiple Choice</option>
              <option value="boolean">True/False</option>
            </select>
          </div>
        </div>

        <button className="btn btn-primary" onClick={buttonCall} disabled={loading}>
          {loading ? 'Loading…' : questions.length > 0 ? 'Generate New Questions' : 'Generate Questions'}
        </button>
      </section>

      {questions.length > 0 ? (
        <section className="card">
          <div className="quiz-top">
            <span className="question-count">Question {currentIndex + 1} of {questions.length}</span>
            <span className="score-pill">Score: {score} / {questions.length}</span>
          </div>
          <div className="progress"><span style={{ width: `${progress}%` }} /></div>

          {category[currentIndex] && <span className="category-tag">{category[currentIndex]}</span>}
          <p className="question">{questions[currentIndex]}</p>

          <div className="answers">
            {options.map((option, i) => (
              <button
                key={option}
                className={answerClass(option)}
                onClick={() => handleAnswerSelection(option)}
                disabled={isAnswered}
              >
                <span className="answer-letter">{String.fromCharCode(65 + i)}</span>
                {option}
              </button>
            ))}
          </div>

          {isAnswered && (
            <p className={`feedback ${picked === correctAnswer[currentIndex] ? 'correct' : 'wrong'}`}>
              {picked === correctAnswer[currentIndex]
                ? 'Correct!'
                : `Not quite. The answer is ${correctAnswer[currentIndex]}.`}
            </p>
          )}

          <div className="nav">
            <button className="btn" onClick={previousQuestion} disabled={currentIndex === 0}>
              ← Previous
            </button>
            <button className="btn" onClick={nextQuestion} disabled={currentIndex >= questions.length - 1}>
              Next →
            </button>
          </div>
        </section>
      ) : (
        <section className="card empty">
          <div className="empty-icon">🧠</div>
          <p>Click "Generate Questions" to begin.</p>
        </section>
      )}
    </div>
  );
}

export default App;
