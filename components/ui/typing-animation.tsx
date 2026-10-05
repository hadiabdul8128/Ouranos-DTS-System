"use client"
// Magic UI Typing Animation (https://magicui.design/r/typing-animation.json), trimmed to a span that types,
// pauses, deletes and moves to the next phrase. Shows the first phrase without motion for reduced motion.

import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

interface TypingAnimationProps {
  words: string[]
  className?: string
  typeSpeed?: number
  deleteSpeed?: number
  delay?: number
  pauseDelay?: number
  loop?: boolean
  showCursor?: boolean
}

export function TypingAnimation({
  words,
  className,
  typeSpeed = 60,
  deleteSpeed,
  delay = 0,
  pauseDelay = 1600,
  loop = true,
  showCursor = true,
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [phase, setPhase] = useState<"typing" | "pause" | "deleting">("typing")
  const [still, setStill] = useState(false)
  const key = useMemo(() => words.join("\u0000"), [words])
  const deletingSpeed = deleteSpeed ?? typeSpeed / 2

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const timer = setTimeout(() => {
      setStill(reduced)
      setDisplayedText(reduced ? words[0] ?? "" : "")
      setCurrentWordIndex(0)
      setCurrentCharIndex(0)
      setPhase("typing")
    })
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (still || !words.length) return
    const wait = delay > 0 && displayedText === "" && currentWordIndex === 0 ? delay : phase === "typing" ? typeSpeed : phase === "deleting" ? deletingSpeed : pauseDelay
    const timeout = setTimeout(() => {
      const graphemes = Array.from(words[currentWordIndex] ?? "")
      if (phase === "typing") {
        if (currentCharIndex < graphemes.length) {
          setDisplayedText(graphemes.slice(0, currentCharIndex + 1).join(""))
          setCurrentCharIndex(currentCharIndex + 1)
        } else if (loop || currentWordIndex < words.length - 1) setPhase("pause")
      } else if (phase === "pause") setPhase("deleting")
      else if (currentCharIndex > 0) {
        setDisplayedText(graphemes.slice(0, currentCharIndex - 1).join(""))
        setCurrentCharIndex(currentCharIndex - 1)
      } else {
        setCurrentWordIndex((currentWordIndex + 1) % words.length)
        setPhase("typing")
      }
    }, wait)
    return () => clearTimeout(timeout)
  }, [still, words, phase, currentCharIndex, currentWordIndex, displayedText, loop, typeSpeed, deletingSpeed, pauseDelay, delay])

  return (
    <span className={cn("typing-animation", className)}>
      {displayedText}
      {showCursor && !still && <span className="typing-animation-cursor" aria-hidden="true">|</span>}
    </span>
  )
}
