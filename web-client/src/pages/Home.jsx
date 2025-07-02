import React from 'react';

const Home = () => {
  return (
    <div style={styles.container}>
      <h1>Welcome to Online Judge</h1>
      <p>Solve coding problems, submit your solutions, and track your progress.</p>
      <p>Navigate to the "Problems" section to get started!</p>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    textAlign: 'center',
    marginTop: '50px',
  },
};

export default Home;