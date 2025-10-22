#pragma once

#include <functional>
#include <utility>
#include <chrono>
#include <cstddef>

namespace boost {

class thread {
public:
    class attributes {
    public:
        void set_stack_size(std::size_t) {}
    };

    class id {
    public:
        id() = default;
        friend constexpr bool operator==(const id&, const id&) { return true; }
        friend constexpr bool operator!=(const id&, const id&) { return false; }
    };

    thread() = default;

    template <class Fn, class... Args>
    explicit thread(Fn&& fn, Args&&... args) {
        fn(std::forward<Args>(args)...);
    }

    template <class Fn>
    thread(attributes&, Fn&& fn) {
        fn();
    }

    thread(const thread&) = delete;
    thread& operator=(const thread&) = delete;

    thread(thread&&) = default;
    thread& operator=(thread&&) = default;

    ~thread() = default;

    bool joinable() const { return false; }
    void join() {}
    void detach() {}

    id get_id() const { return id{}; }
};

namespace this_thread {
inline thread::id get_id() { return thread::id{}; }

template <class Rep, class Period>
inline void sleep_for(const std::chrono::duration<Rep, Period>&) {}

template <class Clock, class Duration>
inline void sleep_until(const std::chrono::time_point<Clock, Duration>&) {}

inline void yield() {}
} // namespace this_thread

class mutex {
public:
    void lock() {}
    void unlock() {}
    bool try_lock() { return true; }
};

class recursive_mutex : public mutex {};

template <class Mutex>
class lock_guard {
public:
    explicit lock_guard(Mutex& m) : m_mutex(m) { m_mutex.lock(); }
    ~lock_guard() { m_mutex.unlock(); }

    lock_guard(const lock_guard&) = delete;
    lock_guard& operator=(const lock_guard&) = delete;

private:
    Mutex& m_mutex;
};

class condition_variable {
public:
    template <class Lock>
    void wait(Lock&) {}

    template <class Lock, class Predicate>
    void wait(Lock&, Predicate predicate) {
        while (!predicate()) {}
    }

    void notify_one() {}
    void notify_all() {}
};

class thread_group {
public:
    thread_group() = default;

    template <class Fn>
    thread* create_thread(Fn&& fn) {
        fn();
        return nullptr;
    }

    void join_all() {}
};

} // namespace boost
