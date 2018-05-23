import message from './hello';

test('welcome message is "Hello World"', () => {
  expect(message).toBe("Hello World");
});
