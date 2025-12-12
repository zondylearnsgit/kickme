import React, { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import { createBuddy } from "../utils/physicsFactory";
import {
  BODY_LABELS,
  WeaponType,
  GameState,
  ThoughtBubbleState,
} from "../types";
import { COLORS, PHYSICS, THOUGHTS } from "../constants";

interface GameCanvasProps {
  weapon: WeaponType;
  onHealthChange: (health: number) => void;
  onThought: (thought: ThoughtBubbleState) => void;
  onDeath: (damageLog: string[]) => void;
  isDead: boolean;
}

// Helper to darken hex color
const darkenColor = (hex: string, amount: number) => {
  let color = hex.substring(1);
  if (color.length === 3)
    color = color
      .split("")
      .map((c) => c + c)
      .join("");
  const num = parseInt(color, 16);
  let r = num >> 16;
  let g = (num >> 8) & 0x00ff;
  let b = num & 0x0000ff;

  r = Math.max(0, Math.min(255, r - 255 * amount));
  g = Math.max(0, Math.min(255, g - 255 * amount));
  b = Math.max(0, Math.min(255, b - 255 * amount));

  return "#" + (g | (b << 8) | (r << 16)).toString(16).padStart(6, "0");
};

const GameCanvas: React.FC<GameCanvasProps> = ({
  weapon,
  onHealthChange,
  onThought,
  onDeath,
  isDead,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const renderLoopRef = useRef<number | null>(null);

  // Game State Refs
  const healthRef = useRef(1000);
  const buddyRef = useRef<Matter.Composite | null>(null);
  const isDeadRef = useRef(isDead);
  const lastThoughtTime = useRef(0);

  // Damage Tracking
  const damageLogRef = useRef<string[]>([]);

  // Interactive Visuals
  const mousePos = useRef({ x: 0, y: 0 });
  const batSwingRef = useRef(0); // 0 to 1 for animation

  // Sync isDead prop to ref
  useEffect(() => {
    isDeadRef.current = isDead;
  }, [isDead]);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = Matter.Engine.create();
    const world = engine.world;
    engineRef.current = engine;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Environment
    const ground = Matter.Bodies.rectangle(width / 2, height - 20, width, 100, {
      isStatic: true,
      label: BODY_LABELS.GROUND,
      friction: 1,
      render: { visible: false },
    });
    const leftWall = Matter.Bodies.rectangle(-50, height / 2, 100, height * 2, {
      isStatic: true,
      label: BODY_LABELS.WALL,
    });
    const rightWall = Matter.Bodies.rectangle(
      width + 50,
      height / 2,
      100,
      height * 2,
      { isStatic: true, label: BODY_LABELS.WALL }
    );

    Matter.Composite.add(world, [ground, leftWall, rightWall]);

    // Create Buddy
    const spawnBuddy = () => {
      const buddy = createBuddy(width / 2, height / 2);
      buddyRef.current = buddy;
      Matter.Composite.add(world, buddy);
      damageLogRef.current = []; // Reset log on spawn
    };
    spawnBuddy();

    // Mouse Constraint
    const mouse = Matter.Mouse.create(canvasRef.current);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false },
      },
    });
    Matter.Composite.add(world, mouseConstraint);

    // --- SELF BALANCING LOGIC ---
    const onBeforeUpdate = () => {
      if (isDeadRef.current || !buddyRef.current) return;
      const torso = buddyRef.current.bodies.find(
        (b) => b.label === BODY_LABELS.TORSO
      );
      if (torso) {
        let angle = torso.angle % (Math.PI * 2);
        if (angle > Math.PI) angle -= Math.PI * 2;
        if (angle < -Math.PI) angle += Math.PI * 2;
        const targetAngle = 0;
        const error = targetAngle - angle;
        const kP = 0.08;
        const kD = 0.15;
        if (Math.abs(torso.angularVelocity) < 0.5) {
          const correction = error * kP - torso.angularVelocity * kD;
          Matter.Body.setAngularVelocity(
            torso,
            torso.angularVelocity + correction
          );
        }
      }
    };
    Matter.Events.on(engine, "beforeUpdate", onBeforeUpdate);

    // Runner
    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // Collision Event
    Matter.Events.on(engine, "collisionStart", (event) => {
      if (isDeadRef.current) return;
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;

        // --- ACID COLLISION LOGIC ---
        const acidDrop =
          bodyA.label === BODY_LABELS.ACID_DROP
            ? bodyA
            : bodyB.label === BODY_LABELS.ACID_DROP
            ? bodyB
            : null;
        const otherBody = acidDrop === bodyA ? bodyB : bodyA;

        // Buddy parts list for checking
        const isBuddyPart = [
          BODY_LABELS.HEAD,
          BODY_LABELS.TORSO,
          BODY_LABELS.ARM_UPPER,
          BODY_LABELS.ARM_LOWER,
          BODY_LABELS.FOOT,
          BODY_LABELS.LEG_INVISIBLE,
        ].includes(otherBody.label);

        if (acidDrop && isBuddyPart) {
          // Apply acid damage
          // Add burn property to body if not exists
          // @ts-ignore - Adding custom prop to Matter body
          otherBody.burnLevel = Math.min(0.8, (otherBody.burnLevel || 0) + 0.1);

          damageLogRef.current.push(`Acid burn on ${otherBody.label}`);

          // Damage Health
          healthRef.current = Math.max(0, healthRef.current - 15);
          onHealthChange(healthRef.current);

          // Remove acid drop
          Matter.Composite.remove(engine.world, acidDrop);

          if (healthRef.current <= 0 && !isDeadRef.current) {
            onDeath(damageLogRef.current);
          }
          return; // handled acid
        }

        // --- IMPACT DAMAGE LOGIC ---
        if (isBuddyPart) {
          const speed = Math.abs(bodyA.speed + bodyB.speed);
          // Significantly increased threshold and reduced multiplier for throwing damage
          if (speed > 15) {
            const damage = Math.floor(speed * 0.3); // Reduced from 1.5
            healthRef.current = Math.max(0, healthRef.current - damage);
            onHealthChange(healthRef.current);

            damageLogRef.current.push(
              `High velocity impact on ${
                isBuddyPart ? otherBody.label : "body"
              } (Speed: ${speed.toFixed(1)})`
            );

            // Thought bubble logic
            const now = Date.now();
            if (speed > 20 && now - lastThoughtTime.current > 1000) {
              const head = buddyRef.current?.bodies.find(
                (b) => b.label === BODY_LABELS.HEAD
              );
              if (head) {
                onThought({
                  id: now,
                  text: THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)],
                  x: head.position.x,
                  y: head.position.y - 60,
                  visible: true,
                });
                lastThoughtTime.current = now;
              }
            }

            if (healthRef.current <= 0 && !isDeadRef.current) {
              onDeath(damageLogRef.current);
            }
          }
        }
      });
    });

    return () => {
      Matter.Events.off(engine, "beforeUpdate", onBeforeUpdate);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
    };
  }, []);

  // --- RESPAWN LOGIC ---
  useEffect(() => {
    if (!isDead && engineRef.current && healthRef.current <= 0) {
      healthRef.current = 1000;
      onHealthChange(1000);
      const world = engineRef.current.world;
      if (buddyRef.current) Matter.Composite.remove(world, buddyRef.current);
      const width = window.innerWidth;
      const height = window.innerHeight;
      const newBuddy = createBuddy(width / 2, height / 2 - 100);
      buddyRef.current = newBuddy;
      Matter.Composite.add(world, newBuddy);
      damageLogRef.current = [];
    }
  }, [isDead, onHealthChange, onDeath]);

  // --- RENDER LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Physics Bodies
      const bodies = Matter.Composite.allBodies(engineRef.current!.world);
      bodies.forEach((body) => {
        if (
          body.render.visible === false &&
          body.label !== BODY_LABELS.LEG_INVISIBLE
        ) {
        }

        ctx.beginPath();
        const { x, y } = body.position;
        const angle = body.angle;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Check burn level
        // @ts-ignore
        const burn = body.burnLevel || 0;
        const getFillStyle = (baseColor: string) =>
          burn > 0 ? darkenColor(baseColor, burn) : baseColor;

        switch (body.label) {
          case BODY_LABELS.HEAD:
            ctx.fillStyle = getFillStyle(COLORS.SKIN);
            ctx.arc(0, 0, PHYSICS.HEAD_RADIUS, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            // --- DRAW NAME TAG ---
            // We draw it here in local space but need to rotate back to keep text upright
            ctx.rotate(-angle); // Undo rotation for text
            ctx.fillStyle = "#000";
            ctx.font = "bold 16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Me", 0, -PHYSICS.HEAD_RADIUS - 15);
            ctx.rotate(angle); // Redo rotation for face

            // Face
            ctx.rotate(-angle);
            ctx.rotate(angle);
            ctx.fillStyle = COLORS.TEXT;
            ctx.strokeStyle = COLORS.TEXT;
            ctx.lineWidth = 2;
            if (isDeadRef.current) {
              const drawX = (ox: number, oy: number) => {
                ctx.beginPath();
                ctx.moveTo(ox - 5, oy - 5);
                ctx.lineTo(ox + 5, oy + 5);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(ox + 5, oy - 5);
                ctx.lineTo(ox - 5, oy + 5);
                ctx.stroke();
              };
              drawX(-10, -5);
              drawX(10, -5);
              ctx.beginPath();
              ctx.arc(0, 15, 10, Math.PI, 0);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.arc(-10, -5, 2, 0, 2 * Math.PI);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(10, -5, 2, 0, 2 * Math.PI);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(0, 5, 10, 0, Math.PI);
              ctx.stroke();
            }
            break;
          case BODY_LABELS.TORSO:
            ctx.fillStyle = getFillStyle(COLORS.SHIRT);
            ctx.arc(0, 0, PHYSICS.TORSO_RADIUS, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = "#000";
            ctx.stroke();
            break;
          case BODY_LABELS.ARM_UPPER:
            ctx.fillStyle = getFillStyle(COLORS.SKIN);
            ctx.beginPath();
            ctx.roundRect(
              -PHYSICS.ARM_WIDTH / 2,
              -PHYSICS.ARM_HEIGHT / 2,
              PHYSICS.ARM_WIDTH,
              PHYSICS.ARM_HEIGHT,
              7
            );
            ctx.fill();
            ctx.stroke();
            break;
          case BODY_LABELS.ARM_LOWER:
            ctx.fillStyle = getFillStyle(COLORS.SKIN);
            ctx.arc(0, 0, PHYSICS.FIST_RADIUS, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            break;
          case BODY_LABELS.LEG_INVISIBLE:
            break;
          case BODY_LABELS.FOOT:
            ctx.fillStyle = getFillStyle(COLORS.SHOES);
            ctx.arc(0, 0, PHYSICS.FOOT_RADIUS, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            break;
          case BODY_LABELS.BULLET:
            ctx.fillStyle = "#4b5563";
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            break;
          case BODY_LABELS.ACID_DROP:
            ctx.fillStyle = "#22c55e"; // Bright Green
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            break;
        }
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#000";
      });

      // 2. Draw Weapon Models (On Top)
      if (!isDeadRef.current) {
        const mx = mousePos.current.x;
        const my = mousePos.current.y;

        if (weapon === WeaponType.BAT) {
          // Decaying swing animation
          batSwingRef.current = Math.max(0, batSwingRef.current - 0.1);

          ctx.save();
          ctx.translate(mx, my);
          // Base rotation + swing rotation
          const swingAngle = (batSwingRef.current * -Math.PI) / 2;
          ctx.rotate(-Math.PI / 4 + swingAngle);

          // Draw Bat
          ctx.fillStyle = "#8B4513"; // SaddleBrown
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;

          // Bat Body
          ctx.beginPath();
          ctx.moveTo(0, 0); // Handle bottom
          ctx.lineTo(10, -80); // Top right
          ctx.quadraticCurveTo(5, -90, 0, -80); // Top curve
          ctx.lineTo(-10, -80); // Top left
          ctx.lineTo(0, 0); // Back to handle
          ctx.fill();
          ctx.stroke();

          // Handle Tape
          ctx.fillStyle = "#DEB887"; // Burlywood
          ctx.fillRect(-4, -25, 8, 20);
          ctx.strokeRect(-4, -25, 8, 20);

          ctx.restore();
        } else if (weapon === WeaponType.GUN) {
          // Find torso for auto-aim
          const torso = buddyRef.current?.bodies.find(
            (b) => b.label === BODY_LABELS.TORSO
          );
          let angle = 0;
          if (torso) {
            angle = Math.atan2(torso.position.y - my, torso.position.x - mx);
          }

          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(angle);

          // Draw Gun (Vector style)
          ctx.fillStyle = "#374151"; // Dark Grey
          ctx.strokeStyle = "#000";

          // Handle
          ctx.fillRect(-10, 0, 15, 25);
          ctx.strokeRect(-10, 0, 15, 25);

          // Barrel
          ctx.fillStyle = "#4B5563";
          ctx.fillRect(0, -10, 40, 15);
          ctx.strokeRect(0, -10, 40, 15);

          // Sight
          ctx.fillStyle = "red";
          ctx.beginPath();
          ctx.arc(38, -12, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        } else if (weapon === WeaponType.ACID) {
          // Draw Flask
          ctx.save();
          ctx.translate(mx, my);
          // Slightly tilt if clicking (simulating pouring) - we can detect click by seeing if we are generating drops,
          // but for now just static upright or slight tilt
          ctx.rotate(Math.PI / 12);

          ctx.lineWidth = 2;
          ctx.strokeStyle = "#000";
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)"; // Glass

          // Flask shape
          ctx.beginPath();
          ctx.moveTo(-10, -30); // Top left neck
          ctx.lineTo(10, -30); // Top right neck
          ctx.lineTo(15, 0); // Shoulder right
          ctx.lineTo(25, 30); // Bottom right
          ctx.quadraticCurveTo(0, 35, -25, 30); // Bottom curve
          ctx.lineTo(-15, 0); // Shoulder left
          ctx.lineTo(-10, -30); // Back to neck
          ctx.fill();
          ctx.stroke();

          // Liquid inside
          ctx.fillStyle = "#22c55e"; // Acid Green
          ctx.beginPath();
          ctx.moveTo(-14, 5); // Liquid level left
          ctx.lineTo(14, 5); // Liquid level right
          ctx.lineTo(24, 29);
          ctx.quadraticCurveTo(0, 34, -24, 29);
          ctx.fill();

          ctx.restore();
        }
      }

      renderLoopRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
    };
  }, [weapon]);

  // --- INPUT HANDLING ---
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    mousePos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleInput = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isDeadRef.current) return;
      if (!engineRef.current || !buddyRef.current) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const clientX =
        "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (weapon === WeaponType.BAT) {
        // Trigger visual swing
        batSwingRef.current = 1.0;

        // Logic: Check proximity and deal direct damage
        const bodies = Matter.Composite.allBodies(engineRef.current.world);
        const clickedBody = bodies.find(
          (b) =>
            Matter.Vector.magnitude(Matter.Vector.sub(b.position, { x, y })) <
            80
        );

        if (
          clickedBody &&
          clickedBody.label !== BODY_LABELS.GROUND &&
          clickedBody.label !== BODY_LABELS.WALL
        ) {
          // Physical Force
          const force = { x: (Math.random() - 0.5) * 0.5, y: -0.3 };
          Matter.Body.applyForce(clickedBody, clickedBody.position, force);

          damageLogRef.current.push("Blunt force trauma from Baseball Bat");

          // Direct Blunt Force Damage
          const damage = 50;
          healthRef.current = Math.max(0, healthRef.current - damage);
          onHealthChange(healthRef.current);

          if (healthRef.current <= 0 && !isDeadRef.current) {
            onDeath(damageLogRef.current);
          }
        }
      } else if (weapon === WeaponType.GUN) {
        const bullet = Matter.Bodies.circle(x, y, 5, {
          label: BODY_LABELS.BULLET,
          density: 0.1,
          frictionAir: 0,
          collisionFilter: { category: PHYSICS.CATEGORY_BULLET },
        });

        damageLogRef.current.push("Gunshot wound");

        const torso = buddyRef.current.bodies.find(
          (b) => b.label === BODY_LABELS.TORSO
        );
        if (torso) {
          const angle = Matter.Vector.angle({ x, y }, torso.position);
          Matter.Body.setPosition(bullet, {
            x: x + Math.cos(angle) * 40,
            y: y + Math.sin(angle) * 40,
          });
          const velocity = Matter.Vector.rotate({ x: 45, y: 0 }, angle);
          Matter.Body.setVelocity(bullet, velocity);
          Matter.Composite.add(engineRef.current.world, bullet);

          setTimeout(() => {
            if (engineRef.current)
              Matter.Composite.remove(engineRef.current.world, bullet);
          }, 2000);
        }
      } else if (weapon === WeaponType.ACID) {
        // Spawn Acid Drops (Particle Spray)
        for (let i = 0; i < 5; i++) {
          const offsetX = (Math.random() - 0.5) * 10;
          const drop = Matter.Bodies.circle(x + offsetX, y, 4, {
            label: BODY_LABELS.ACID_DROP,
            friction: 0,
            frictionAir: 0.05,
            restitution: 0,
            density: 0.005,
            render: { visible: false }, // Custom render
          });

          // Initial slight downward velocity + spread
          Matter.Body.setVelocity(drop, {
            x: (Math.random() - 0.5) * 2,
            y: 2 + Math.random() * 3,
          });

          Matter.Composite.add(engineRef.current.world, drop);

          // Cleanup drops if they miss
          setTimeout(() => {
            if (engineRef.current)
              Matter.Composite.remove(engineRef.current.world, drop);
          }, 3000);
        }
      }
    },
    [weapon, isDead]
  );

  // Determine cursor style
  const cursorClass =
    weapon === WeaponType.BAT ||
    weapon === WeaponType.GUN ||
    weapon === WeaponType.ACID
      ? "cursor-none"
      : "cursor-crosshair";

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      onMouseDown={handleInput}
      onTouchStart={handleInput}
      onMouseMove={handleMouseMove}
      className={`absolute top-0 left-0 w-full h-full touch-none z-0 ${cursorClass}`}
    />
  );
};

export default GameCanvas;
