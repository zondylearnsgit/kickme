import Matter from 'matter-js';
import { PHYSICS } from '../constants';
import { BODY_LABELS } from '../types';

const { Bodies, Body, Composite, Constraint } = Matter;

export const createBuddy = (x: number, y: number) => {
  const group = Body.nextGroup(true); // Non-colliding group for self

  // Common options for body parts
  const partOptions = {
    collisionFilter: { group: group },
    friction: 0.5,
    restitution: 0.2, // Bounciness
    density: 0.01,
    render: { visible: false } // We will custom render everything
  };

  // --- HEAD ---
  const head = Bodies.circle(x, y - 70, PHYSICS.HEAD_RADIUS, {
    ...partOptions,
    label: BODY_LABELS.HEAD,
    density: 0.01,
  });

  // --- TORSO ---
  const torso = Bodies.circle(x, y, PHYSICS.TORSO_RADIUS, {
    ...partOptions,
    label: BODY_LABELS.TORSO,
  });

  // --- ARMS ---
  const createArm = (side: 'left' | 'right') => {
    const xOffset = side === 'left' ? -PHYSICS.TORSO_RADIUS - 10 : PHYSICS.TORSO_RADIUS + 10;
    
    // Upper Arm (Oval-ish rect)
    const upperArm = Bodies.rectangle(x + xOffset, y - 20, PHYSICS.ARM_WIDTH, PHYSICS.ARM_HEIGHT, {
      ...partOptions,
      label: BODY_LABELS.ARM_UPPER,
      chamfer: { radius: 7 }
    });

    // Fist/Forearm
    const fist = Bodies.circle(x + xOffset, y + 10, PHYSICS.FIST_RADIUS, {
      ...partOptions,
      label: BODY_LABELS.ARM_LOWER,
    });

    // Shoulder Joint
    const shoulder = Constraint.create({
      bodyA: torso,
      bodyB: upperArm,
      pointA: { x: side === 'left' ? -30 : 30, y: -10 },
      pointB: { x: 0, y: -PHYSICS.ARM_HEIGHT / 2 + 5 },
      stiffness: PHYSICS.STIFFNESS, // Arms remain floppy
      damping: PHYSICS.DAMPING,
      length: 0,
      render: { visible: false }
    });

    // Elbow Joint
    const elbow = Constraint.create({
      bodyA: upperArm,
      bodyB: fist,
      pointA: { x: 0, y: PHYSICS.ARM_HEIGHT / 2 - 5 },
      pointB: { x: 0, y: -5 },
      stiffness: PHYSICS.STIFFNESS,
      damping: PHYSICS.DAMPING,
      length: 10,
      render: { visible: false }
    });

    return { bodies: [upperArm, fist], constraints: [shoulder, elbow] };
  };

  const leftArm = createArm('left');
  const rightArm = createArm('right');

  // --- LEGS (Sturdy Standing Logic) ---
  
  const createLeg = (side: 'left' | 'right') => {
    const xOffset = side === 'left' ? -20 : 20;

    // Invisible Leg Bone
    // Increased density for stability (lower center of gravity)
    // Slightly wider to look like a sturdy bone in debug, though invisible
    const legBone = Bodies.rectangle(x + xOffset, y + 60, 14, PHYSICS.LEG_LENGTH, {
        ...partOptions,
        label: BODY_LABELS.LEG_INVISIBLE,
        render: { visible: false }, 
        density: 0.04, 
    });

    // Foot
    // TRICK: Use a Rectangle physics body for flat standing, but render as circle.
    // This prevents the buddy from rolling on their feet.
    const footWidth = PHYSICS.FOOT_RADIUS * 2;
    const footHeight = 16;
    const foot = Bodies.rectangle(x + xOffset, y + 60 + PHYSICS.LEG_LENGTH/2 + 5, footWidth, footHeight, {
      ...partOptions,
      label: BODY_LABELS.FOOT,
      friction: 1.0, // High friction to grip ground
      density: 0.1, // Very heavy feet to anchor
      chamfer: { radius: 4 } // Rounded corners on the physics box
    });

    // Hip Joint - DUAL CONSTRAINTS
    // Using two constraints spaced apart creates a "rigid" joint that resists rotation
    // This allows the buddy to stand upright.
    const hipInner = Constraint.create({
        bodyA: torso,
        bodyB: legBone,
        pointA: { x: xOffset - 8, y: PHYSICS.TORSO_RADIUS * 0.8 },
        pointB: { x: -7, y: -PHYSICS.LEG_LENGTH / 2 },
        stiffness: 0.6, // Sturdy but has give
        damping: 0.1,
        length: 0,
        render: { visible: false }
    });
    
    const hipOuter = Constraint.create({
        bodyA: torso,
        bodyB: legBone,
        pointA: { x: xOffset + 8, y: PHYSICS.TORSO_RADIUS * 0.8 },
        pointB: { x: 7, y: -PHYSICS.LEG_LENGTH / 2 },
        stiffness: 0.6,
        damping: 0.1,
        length: 0,
        render: { visible: false }
    });

    // Ankle Joint - Stiff
    const ankle = Constraint.create({
        bodyA: legBone,
        bodyB: foot,
        pointA: { x: 0, y: PHYSICS.LEG_LENGTH / 2 },
        pointB: { x: 0, y: -5 },
        stiffness: 0.8,
        damping: 0.1,
        length: 0,
        render: { visible: false }
    });

    return { bodies: [legBone, foot], constraints: [hipInner, hipOuter, ankle] };
  };

  const leftLeg = createLeg('left');
  const rightLeg = createLeg('right');

  const bodies = [
    head, torso,
    ...leftArm.bodies, ...rightArm.bodies,
    ...leftLeg.bodies, ...rightLeg.bodies
  ];

  // Neck - DUAL CONSTRAINTS
  // Keeps the head upright
  const neckLeft = Constraint.create({
      bodyA: torso,
      bodyB: head,
      pointA: { x: -8, y: -PHYSICS.TORSO_RADIUS + 5 },
      pointB: { x: -8, y: PHYSICS.HEAD_RADIUS - 5 },
      stiffness: 0.7,
      damping: 0.1,
      length: 0,
      render: { visible: false }
  });

  const neckRight = Constraint.create({
      bodyA: torso,
      bodyB: head,
      pointA: { x: 8, y: -PHYSICS.TORSO_RADIUS + 5 },
      pointB: { x: 8, y: PHYSICS.HEAD_RADIUS - 5 },
      stiffness: 0.7,
      damping: 0.1,
      length: 0,
      render: { visible: false }
  });

  const constraints = [
    ...leftArm.constraints, ...rightArm.constraints,
    ...leftLeg.constraints, ...rightLeg.constraints,
    neckLeft, neckRight
  ];

  return Composite.create({
    bodies,
    constraints,
    label: 'Buddy'
  });
};